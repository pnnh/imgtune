# 研究报告：浏览器端图片转换与服务端错误处理

**阶段**: Phase 0 研究（已更新 2026-08-06）
**日期**: 2026-08-05 / 更新: 2026-08-06
**功能**: [spec.md](./spec.md)

---

## 1. 浏览器 Canvas API 图片转换能力

**决策**: 使用 `HTMLCanvasElement.toBlob()` 作为浏览器端转换的核心实现，无需额外依赖库。

**理由**:

- 零依赖，无包体积开销
- 原生浏览器 API，性能最优
- 覆盖目标格式：JPEG（含质量参数）、PNG、WebP（主流浏览器）
- GIF 输入解码由浏览器原生完成（Canvas 绘制第一帧）

**实现方式**:

```ts
// 核心逻辑伪代码
const img = new Image();
img.src = URL.createObjectURL(file);
await new Promise(resolve => img.onload = resolve);
const canvas = document.createElement('canvas');
canvas.width = img.naturalWidth;
canvas.height = img.naturalHeight;
canvas.getContext('2d')!.drawImage(img, 0, 0);
const blob = await new Promise<Blob>(resolve =>
  canvas.toBlob(resolve, `image/${targetMime}`, quality / 100)
);
```

**备选方案（已评估，未采用）**:

- `@squoosh/lib` WASM 版：包体积 > 500KB，加载时间过长，对于基础格式转换不值得
- `browser-image-compression`：仅压缩，不支持格式转换
- `jimp`（browser build）：400KB+ 包体积，Canvas API 已够用

---

## 2. 浏览器格式支持矩阵

**决策**: 定义静态能力矩阵，运行时 + 构建时双重控制格式可用性。

| 输入格式 | 输出格式 | 浏览器端 | 备注 |
| --------- | --------- | --------- | ------ |
| JPEG | PNG | ✓ | |
| JPEG | WebP | ✓ | Safari 14+ |
| JPEG | GIF | ✗ | 浏览器无 GIF 编码 |
| PNG | JPEG | ✓ | 透明区域填白 |
| PNG | WebP | ✓ | Safari 14+ |
| PNG | GIF | ✗ | 浏览器无 GIF 编码 |
| WebP | JPEG | ✓ | |
| WebP | PNG | ✓ | |
| WebP | GIF | ✗ | 浏览器无 GIF 编码 |
| GIF | JPEG | ✓ | 仅第一帧，需提示用户 |
| GIF | PNG | ✓ | 仅第一帧，需提示用户 |
| GIF | WebP | ✓ | 仅第一帧，需提示用户 |
| GIF | GIF | ✗ | 动画 GIF 需服务端；失败时展示错误提示 |

**运行时行为**: GIF 输出始终路由服务端（`strategy: "server"`）；服务端失败时响应式展示错误（不预先禁用）。

---

## 3. 服务端错误处理（规格澄清 2026-08-06 替换原 OFFLINE 章节）

**决策**: 响应式错误处理，区分 HTTP 错误与网络超时，移除 OFFLINE 构建模式。

**理由**: OFFLINE 构建模式在代码中引入大量 `if (import.meta.env.OFFLINE)` 判断，实现复杂度不可接受。改用运行时错误提示更符合实际使用场景（服务端偶发故障，而非永久离线）。

**实现**:

```ts
// AbortController 超时（30 秒）
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
try {
  const response = await fetch("/api/convert", { signal: controller.signal, ... });
  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    let errMsg = getMessage("conversionFailed");
    if (contentType.includes("application/json")) {
      try { errMsg = ((await response.json()) as { error?: string }).error ?? errMsg; }
      catch { /* 非标准 JSON 回退 */ }
    }
    throw new Error(getMessage("backendError").replace("{status}", String(response.status)));
  }
} catch (err) {
  if (err instanceof DOMException && err.name === "AbortError") {
    throw new Error(getMessage("connectionTimeout"));
  }
  throw err;
} finally {
  clearTimeout(timeoutId);
}
```

**新增 i18n 键**:

- `backendError`: "后端转换失败 ({status})" — 含 `{status}` 占位符
- `connectionTimeout`: "连接超时，请稍后重试" — 无占位符

**备选方案（已评估，未采用）**:

- 主动健康检测（ping）：增加额外网络开销，大多数情况服务正常无需提前检测
- 自动重试：隐藏错误，用户可能不知道发生了什么，违反规格要求"明确提示"

---

## 4. GIF 第一帧提取

**决策**: 直接使用 Canvas API 提取，无需额外库。

**理由**: 浏览器将 `img.src` 设为 GIF 对象 URL 后，`drawImage()` 总是绘制第一帧（动画帧由浏览器渲染层控制，Canvas API 只获取当前渲染帧，对 GIF 始终为第一帧）。

**用户提示策略**: 当检测到输入为 GIF（`file.type === 'image/gif'`）且目标非 GIF 时，在 UI 显示提示横幅说明仅转换第一帧。

---

## 5. 转换路由策略

**决策**: 实现两层路由（规格澄清后移除 OFFLINE 层）：格式矩阵决定路由，无运行时 hasBackend 判断。

```
convertImage(options):
  capability = matrix["${input}→${output}"]
  if (capability.strategy === 'unavailable')
    → 抛出错误（当前永不到达，hasBackend 始终 true）
  if (capability.strategy === 'browser')
    → browserConvert(options)   // JPEG/PNG/WebP 互转
  → serverConvert(options)      // 仅 GIF 输出
```

**服务端独有场景**: 输出格式为 GIF（浏览器无 GIF 编码能力）。

所有其他格式组合固定使用浏览器端，节省服务器资源。

---

## 6. `PlatformCapabilities` 重构（含 extension/webview hasBackend）

**决策**: `canConvertImages` 始终 `true`；`hasBackend` 对所有运行时类型（含 extension/webview）设为 `true`。

**理由**: Chrome 扩展通过 `host_permissions` 声明可访问任意外部 HTTP API；Webview 可访问父 App 内嵌的后端服务。两者与普通 Web 无本质区别，不应预先限制访问能力。错误由响应式异常处理捕获。

**新设计**:

```ts
interface PlatformCapabilities {
  canConvertImages: boolean;  // 始终 true
  hasBackend: boolean;        // 始终 true（含 extension/webview）
  canInstallPwa: boolean;
  router: "browser" | "hash";
}
```

**实现**: `detect.ts` 中 extension 和 webview 分支改为 `hasBackend: true`。

---

## 7. WebP 浏览器支持检测

**决策**: 运行时检测 WebP 输出支持，对不支持的浏览器禁用 WebP 输出选项（非报错）。

**实现**: 尝试 `canvas.toBlob(cb, 'image/webp')` 并检查返回 Blob 的 `type` 是否为 `image/webp`（若浏览器不支持会回退到 `image/png`）。

**已知限制**:

- Safari 13 及以下：WebP 输出不可用，选项禁用
- Safari 14+：完全支持
- 所有主流 Chrome/Firefox：完全支持
