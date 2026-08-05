# 研究报告：浏览器端图片转换与离线构建模式

**阶段**: Phase 0 研究  
**日期**: 2026-08-05  
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
| GIF | GIF | ✗ | 动画 GIF 需服务端 |

**OFFLINE 模式时**: GIF 输出格式选项完全从 UI 移除（tree-shaking 消除代码路径）。

---

## 3. Vite `define` 与构建时 tree-shaking

**决策**: 在 `vite.config.ts` 中通过 `define` 注入 `import.meta.env.OFFLINE` 为构建时布尔常量。

**理由**:

- Rollup/Vite 的 `define` 在编译期进行字符串替换，使 `if (import.meta.env.OFFLINE)` 分支被识别为死代码
- 死代码在 Rollup tree-shaking 阶段完全移除，产物中不留任何 `/api/convert` 引用
- `VITE_OFFLINE` 作为环境变量名（pnpm 脚本中传入），`import.meta.env.OFFLINE` 作为代码中访问键

**实现**:

```ts
// vite.config.ts 中
define: {
  'import.meta.env.OFFLINE': JSON.stringify(process.env.VITE_OFFLINE === 'true'),
}
```

**TypeScript 类型声明**（需在 `vite-env.d.ts` 或 `env.d.ts` 中扩展）:

```ts
interface ImportMetaEnv {
  readonly OFFLINE: boolean;
}
```

**备选方案（已评估，未采用）**:

- `import.meta.env.VITE_OFFLINE`：Vite 内置前缀方案，会暴露到客户端 env 对象，但无法保证死代码消除（Vite 对 VITE_ 前缀变量的 tree-shaking 行为不稳定）
- 运行时条件判断：无法实现构建时移除，产物仍含 API 调用代码

---

## 4. GIF 第一帧提取

**决策**: 直接使用 Canvas API 提取，无需额外库。

**理由**: 浏览器将 `img.src` 设为 GIF 对象 URL 后，`drawImage()` 总是绘制第一帧（动画帧由浏览器渲染层控制，Canvas API 只获取当前渲染帧，对 GIF 始终为第一帧）。

**用户提示策略**: 当检测到输入为 GIF（`file.type === 'image/gif'`）且目标非 GIF 时，在 UI 显示提示横幅说明仅转换第一帧。

---

## 5. 转换路由策略

**决策**: 实现三层路由：构建时 OFFLINE → 运行时 hasBackend → 格式矩阵。

```
convertImage(options):
  if (import.meta.env.OFFLINE)
    → browserConvert(options)  // 服务端路径静态消除
  else if (!hasBackend)
    → browserConvert(options)
  else if (isServerOnlyFormat(options.targetFormat))
    → serverConvert(options)   // 仅 GIF 输出走服务端
  else
    → browserConvert(options)  // 节省服务器资源，优先浏览器
```

**服务端独有场景**（非 OFFLINE 且 hasBackend）:

- 输出格式为 GIF（动画 GIF 需服务端 Sharp）

所有其他格式组合优先使用浏览器端，既节省服务器资源又保障离线可用性。

---

## 6. `PlatformCapabilities` 重构

**决策**: 重构 `canConvertImages` 语义，新增 `hasBackend` 到 `PlatformCapabilities`。

**当前问题**:

- `canConvertImages: false` 对 `extension`/`webview` 直接拦截整个转换 UI
- 但 extension/webview 其实可以执行浏览器端转换

**新设计**:

```ts
interface PlatformCapabilities {
  canConvertImages: boolean;  // 始终 true（浏览器端始终可用）
  hasBackend: boolean;        // 来自 RuntimeContext.hasBackend
  canInstallPwa: boolean;
  router: "browser" | "hash";
}
```

**向后兼容**: `computeCapabilities()` 中 `canConvertImages` 全部改为 `true`，`hasBackend` 从 `runtime.hasBackend` 取值。

---

## 7. 新增构建脚本

**决策**: 在 `package.json` 中追加三个 offline 变体脚本。

```json
{
  "build:web:offline":       "VITE_BUILD_TARGET=web VITE_OFFLINE=true vite build",
  "build:extension:offline": "VITE_BUILD_TARGET=extension VITE_OFFLINE=true vite build",
  "build:webview:offline":   "VITE_BUILD_TARGET=webview VITE_OFFLINE=true vite build"
}
```

**备选方案**: 使用 `cross-env` 包解决 Windows 兼容性——项目目前无 Windows CI，暂不引入。

---

## 8. WebP 浏览器支持检测

**决策**: 运行时检测 WebP 输出支持，对不支持的浏览器禁用 WebP 输出选项（非报错）。

**实现**: 使用 Canvas toBlob 测试或 `navigator.userAgent` 检测 Safari 版本。
推荐方式：尝试 `canvas.toBlob(cb, 'image/webp')` 并检查返回 Blob 的 `type` 是否为 `image/webp`（若浏览器不支持会回退到 `image/png`）。

**已知限制**:

- Safari 13 及以下：WebP 输出不可用，选项禁用
- Safari 14+：完全支持
- 所有主流 Chrome/Firefox：完全支持
