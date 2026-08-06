# 接口契约：转换模块

**阶段**: Phase 1 设计（已更新 2026-08-06）
**日期**: 2026-08-05 / 更新: 2026-08-06
**功能**: [spec.md](../spec.md)

---

## 模块结构

```
src/client/convert/
├── browserConvert.ts   # 浏览器端 Canvas API 转换
├── serverConvert.ts    # 服务端 /api/convert 调用（OFFLINE 时 tree-shaking 消除）
├── router.ts           # 转换路由器（策略选择）
└── capabilities.ts     # 能力矩阵计算
```

---

## `capabilities.ts` — 能力矩阵

### `computeCapabilityMatrix(hasBackend: boolean): CapabilityMatrix`

```ts
/**
 * 计算当前环境下所有格式转换组合的可用策略。
 * hasBackend 当前始终为 true；无 OFFLINE 构建时条件。
 */
function computeCapabilityMatrix(hasBackend: boolean): CapabilityMatrix
```

**行为**:

- GIF 输出：`hasBackend === true` → `server`；`hasBackend === false` → `unavailable`（当前不会触发）
- GIF 输入转非 GIF 输出：附加 `requiresWarning: "gifFirstFrameWarning"`
- 其余格式组合：始终 `browser`

### `checkWebPOutputSupport(): Promise<boolean>`

```ts
/**
 * 运行时检测当前浏览器是否支持 WebP 输出。
 * 通过 Canvas.toBlob 测试实际支持情况。
 */
function checkWebPOutputSupport(): Promise<boolean>
```

---

## `browserConvert.ts` — 浏览器端转换

### `browserConvert(options: ConversionOptions): Promise<ConversionResult>`

```ts
/**
 * 使用 Canvas API 执行图片格式转换。
 * 不发起任何网络请求，纯客户端执行。
 *
 * 抛出 Error 当：
 * - 目标格式在当前浏览器不支持（如旧版 Safari WebP 输出）
 * - Canvas 上下文获取失败
 * - toBlob 返回 null
 */
function browserConvert(options: ConversionOptions): Promise<ConversionResult>
```

**内部流程**:

1. `URL.createObjectURL(file)` → `new Image()` → 等待 `onload`
2. 创建 `HTMLCanvasElement`，设置 naturalWidth × naturalHeight
3. `canvas.getContext('2d').drawImage(img, 0, 0)`
4. PNG 透明背景 → JPEG 转换时填充白色背景
5. `canvas.toBlob(resolve, mimeType, quality/100)` → 返回 `Blob`
6. `URL.revokeObjectURL()` 清理
7. 返回 `ConversionResult { blob, processorUsed: 'canvas', durationMs }`

---

## `serverConvert.ts` — 服务端转换

### `serverConvert(options: ConversionOptions): Promise<ConversionResult>`

```ts
/**
 * 通过 POST /api/convert 调用后端 Express + Sharp/Jimp 转换。
 * 含 30 秒 AbortController 超时；区分 HTTP 错误与网络超时两类错误提示。
 */
function serverConvert(options: ConversionOptions): Promise<ConversionResult>
```

**契约**:

- 请求：`multipart/form-data`，字段：`file`, `targetFormat`, `quality`, `compressionLevel`, `lossless`
- 成功响应：`200 OK`，`Content-Type: image/*`，二进制 Blob，头部含 `X-Processor-Used`
- HTTP 错误响应：抛出含状态码的错误（`getMessage("backendError").replace("{status}", status)`）
- 网络超时（30s 无响应）：抛出 `getMessage("connectionTimeout")`
- 非 JSON 错误响应：安全回退为通用 `getMessage("conversionFailed")`，不崩溃

---

## `router.ts` — 转换路由器

### `routeConversion(options: ConversionOptions, matrix: CapabilityMatrix): Promise<ConversionResult>`

```ts
/**
 * 根据能力矩阵选择转换策略并执行。
 * 构建时 OFFLINE 路径通过静态分析消除服务端导入。
 *
 * 抛出 Error 当目标格式 strategy === 'unavailable'。
 */
function routeConversion(
  options: ConversionOptions,
  matrix: CapabilityMatrix
): Promise<ConversionResult>
```

**路由逻辑**:

```ts
const capability = matrix[`${inputFmt}→${options.targetFormat}`];
if (capability.strategy === 'unavailable') throw new Error('...');
if (capability.strategy === 'browser') {
  return browserConvert(options);
}
// 服务端路径（仅 GIF 输出）
return serverConvert(options);
```

---

## 后端 `/api/convert` 契约（无变化）

现有接口保持不变，仅增加文档说明：

**端点**: `POST /api/convert`

**请求**:

```
Content-Type: multipart/form-data
Fields:
  file            File     必须  上传的图片文件
  targetFormat    string   必须  "jpg"|"jpeg"|"png"|"webp"|"gif"
  quality         string   可选  "1"–"100"，默认 "80"
  compressionLevel string  可选  "0"–"9"，默认 "6"
  lossless        string   可选  "true"|"false"，默认 "false"
```

**成功响应** `200 OK`:

```
Content-Type: image/<format>
Content-Length: <bytes>
X-Processor-Used: sharp | jimp
Body: 二进制图片数据
```

**错误响应** `400 | 413 | 500`:

```json
{ "error": "描述错误原因的字符串" }
```

---

## `vite-env.d.ts` 扩展（已废弃）

~~`OFFLINE: boolean`~~ — 规格澄清后不再需要 OFFLINE 类型声明。`src/client/vite-env.d.ts` 中 OFFLINE 声明应删除。

---

## 构建脚本契约

| 脚本名 | 环境变量 | 输出目录 |
| -------- | --------- | --------- |
| `build:web` | `VITE_BUILD_TARGET=web` | `dist/` |
| `build:extension` | `VITE_BUILD_TARGET=extension` | `dist-ext/` |
| `build:webview` | `VITE_BUILD_TARGET=webview` | `dist-webview/` |

> ~~`build:*:offline` 脚本~~已从规格中移除。
