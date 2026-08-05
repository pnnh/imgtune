# 数据模型：浏览器端图片转换与离线构建模式

**阶段**: Phase 1 设计  
**日期**: 2026-08-05  
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
  | "unavailable"; // 当前环境不支持（OFFLINE 下 GIF 输出）
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

**矩阵构建规则**（按优先级）:

1. **构建时 OFFLINE = true**: GIF 输出 → `unavailable`；其余全部 → `browser`
2. **运行时 hasBackend = false**: GIF 输出 → `unavailable`；其余全部 → `browser`
3. **运行时 hasBackend = true**: GIF 输出 → `server`；其余全部 → `browser`

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

**变更**: `extension`/`webview` 的 `canConvertImages` 由 `false` 改为 `true`。`hasBackend` 从 `RuntimeContext.hasBackend` 透传。

---

## 状态转换

### 转换操作状态机

```
idle → uploading → converting → success
                             ↘ error
```

| 状态 | 描述 |
| ------ | ------ |
| `idle` | 未选择文件 |
| `uploading` | 文件选择/拖放处理中 |
| `converting` | 浏览器端 Canvas 处理或等待服务端响应 |
| `success` | 转换完成，结果 Blob 可用 |
| `error` | 转换失败，显示错误信息 |

### 格式选项可见性状态

```
buildTime(OFFLINE=true)  →  unavailableFormats = ["gif"]
runtime(hasBackend=false) →  unavailableFormats = ["gif"]  
runtime(hasBackend=true)  →  unavailableFormats = []
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
computeCapabilityMatrix(OFFLINE, hasBackend)
    │
    ├── 过滤可用输出格式 → 更新 UI 格式选择器
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
