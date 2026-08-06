# 数据模型：浏览器端图片转换与服务端错误处理

**阶段**: Phase 1 设计（已更新 2026-08-06）
**日期**: 2026-08-05 / 更新: 2026-08-06
**功能**: [spec.md](./spec.md)

---

## 核心实体

### ImageFormat（图片格式）

```ts
type ImageFormat = "jpeg" | "png" | "webp" | "gif";
// 注：UI 中展示 "jpg"，内部统一规范化为 "jpeg"
```

### ConversionStrategy（转换策略）

描述某输入/输出格式组合所使用的处理路径。

```ts
type ConversionStrategy =
  | "browser"      // Canvas API 处理，无网络请求
  | "server"       // POST /api/convert
  | "unavailable"; // 当前环境不支持（hasBackend=false 时 GIF 输出）
```

### FormatCapability（格式能力描述）

```ts
interface FormatCapability {
  strategy: ConversionStrategy;
  /** 是否需要用户提示（如 GIF 仅第一帧） */
  requiresWarning?: string;
}
```

### CapabilityMatrix（能力矩阵）

运行时 + 构建时联合计算，描述所有格式转换组合的可用策略。

```ts
// 键格式: "${inputFormat}→${outputFormat}"
type CapabilityMatrix = Record<string, FormatCapability>;
```

**矩阵构建规则**:

1. **hasBackend = false**: GIF 输出 → `unavailable`；其余全部 → `browser`（当前不触发，hasBackend 始终为 true）
2. **hasBackend = true**: GIF 输出 → `server`；其余全部 → `browser`

**GIF 输入 + 非 GIF 输出** 始终附带 `requiresWarning: "gifFirstFrameWarning"`。

### ConversionOptions（转换请求参数）

```ts
interface ConversionOptions {
  file: File;
  targetFormat: ImageFormat;
  quality: number;          // 1–100，JPEG 和 WebP 有效
  lossless: boolean;        // WebP 无损模式
  compressionLevel: number; // 0–9，PNG 压缩级别
}
```

### ConversionResult（转换结果）

```ts
interface ConversionResult {
  blob: Blob;
  processorUsed: "canvas" | "sharp" | "jimp";
  /** 转换耗时（毫秒） */
  durationMs: number;
}
```

### PlatformCapabilities（平台能力）

对现有接口的扩展（重构 `src/client/runtime/context.tsx`）：

```ts
interface PlatformCapabilities {
  /** 是否有任何转换能力（浏览器端始终 true） */
  canConvertImages: boolean;
  /** 是否可访问后端 API */
  hasBackend: boolean;
  /** 是否支持 PWA 安装 */
  canInstallPwa: boolean;
  /** 路由模式 */
  router: "browser" | "hash";
}
```

**变更**: `extension`/`webview` 的 `canConvertImages` 由 `false` 改为 `true`；`hasBackend` 所有运行时类型均为 `true`（含 extension/webview）。

---

## 状态转换

### 转换操作状态机

```
idle → uploading → converting → success
                             ↘ error (serverError | timeoutError | browserError)
```

| 状态 | 描述 |
| ------ | ------ |
| `idle` | 未选择文件 |
| `uploading` | 文件选择/拖放处理中 |
| `converting` | 浏览器端 Canvas 处理或等待服务端响应 |
| `success` | 转换完成，结果 Blob 可用 |
| `serverError` | 服务端返回 HTTP 错误，error 消息含状态码 |
| `timeoutError` | 服务端请求超时（30s），error 消息为超时提示 |
| `browserError` | Canvas 处理失败（如不支持的格式） |

### 格式选项可见性状态

```
hasBackend = true（所有运行时）→  unavailableFormats = []（GIF 始终可用）
WebP 不支持的浏览器            →  webpDisabled = true
```

---

## 数据流

```
用户选择文件
    │
    ▼
normalizeInputFormat(file.type)
    │
    ▼
computeCapabilityMatrix(hasBackend)
    │
    ├── 格式选择器（GIF 始终启用；WebP 按运行时检测）
    │
    ▼
用户点击转换
    │
    ▼
routeConversion(options, matrix)
    │
    ├─ strategy=browser → browserConvert() → Canvas.toBlob()
    │
    └─ strategy=server  → serverConvert()  → POST /api/convert
    │
    ▼
ConversionResult → 更新预览 + 触发下载
```

---

## 验证规则

| 字段 | 规则 |
| ------ | ------ |
| `file` | 必须为图片 MIME 类型 (`image/*`) |
| `targetFormat` | 必须在 `CapabilityMatrix` 中且 strategy ≠ `unavailable` |
| `quality` | 整数 1–100，仅对 JPEG/WebP 有效 |
| `compressionLevel` | 整数 0–9，仅对 PNG 有效 |
| `file.size` | 浏览器端转换建议 < 50MB（超出时显示性能警告） |
