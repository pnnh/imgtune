# 接口契约：转换模块

**阶段**: Phase 1 设计  
**日期**: 2026-08-05  
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
 * import.meta.env.OFFLINE 在构建时静态替换，不作为函数参数传入。
 */
function computeCapabilityMatrix(hasBackend: boolean): CapabilityMatrix
```

**行为**:

- 构建时若 `import.meta.env.OFFLINE === true`：所有输出为 GIF 的组合返回 `unavailable`，其余全部返回 `browser`
- 运行时 `hasBackend === false`：同上
- 运行时 `hasBackend === true`：GIF 输出返回 `server`，其余返回 `browser`
- GIF 输入转非 GIF 输出：附加 `requiresWarning: "gifFirstFrameWarning"`

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
 * 此模块整体在 import.meta.env.OFFLINE === true 时被 tree-shaking 消除。
 */
function serverConvert(options: ConversionOptions): Promise<ConversionResult>
```

**契约**:

- 请求：`multipart/form-data`，字段：`file`, `targetFormat`, `quality`, `compressionLevel`, `lossless`
- 成功响应：`200 OK`，`Content-Type: image/*`，二进制 Blob，头部含 `X-Processor-Used`
- 错误响应：`4xx/5xx`，`Content-Type: application/json`，`{ error: string }`

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
if (import.meta.env.OFFLINE || capability.strategy === 'browser') {
  return browserConvert(options);
}
return serverConvert(options); // 此行在 OFFLINE 构建时被消除
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

## `vite-env.d.ts` 扩展（TypeScript 类型）

需在 `src/client/vite-env.d.ts`（或 `env.d.ts`）中添加：

```ts
interface ImportMetaEnv {
  readonly OFFLINE: boolean;
}
```

---

## 构建脚本契约

| 脚本名 | 环境变量 | 输出目录 | OFFLINE |
| -------- | --------- | --------- | --------- |
| `build:web` | `VITE_BUILD_TARGET=web` | `dist/` | false |
| `build:web:offline` | `VITE_BUILD_TARGET=web VITE_OFFLINE=true` | `dist/` | true |
| `build:extension` | `VITE_BUILD_TARGET=extension` | `dist-ext/` | false |
| `build:extension:offline` | `VITE_BUILD_TARGET=extension VITE_OFFLINE=true` | `dist-ext/` | true |
| `build:webview` | `VITE_BUILD_TARGET=webview` | `dist-webview/` | false |
| `build:webview:offline` | `VITE_BUILD_TARGET=webview VITE_OFFLINE=true` | `dist-webview/` | true |
