# API 契约：图片转换接口

**版本**: 1.0
**基础路径**: `/api`
**认证**: 无（公开接口）

---

## POST /api/convert

将上传的图片转换为指定格式，返回转换后的二进制文件。

### 请求

**Content-Type**: `multipart/form-data`

| 字段名 | 类型 | 必填 | 约束 | 说明 |
| -------- | ------ | ------ | ------ | ------ |
| `file` | `File` | ✅ | 大小 ≤ 10MB，MIME 须为 `image/{jpeg,png,webp,gif}` | 原始图片文件 |
| `targetFormat` | `string` | ✅ | 枚举：`jpg`、`png`、`webp`、`gif` | 目标格式 |
| `quality` | `string` | ❌ | 整数字符串，范围 1–100，默认 `"80"` | JPEG/WebP 质量（其他格式忽略） |
| `compressionLevel` | `string` | ❌ | 整数字符串，范围 0–9，默认 `"6"` | PNG 压缩级别（其他格式忽略） |
| `lossless` | `string` | ❌ | `"true"` / `"false"`，默认 `"false"` | WebP 无损模式（其他格式忽略） |

**示例请求（multipart）**:

```
POST /api/convert HTTP/1.1
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="file"; filename="photo.png"
Content-Type: image/png
[二进制内容]

------FormBoundary
Content-Disposition: form-data; name="targetFormat"
webp

------FormBoundary
Content-Disposition: form-data; name="quality"
85
------FormBoundary--
```

### 响应

#### 成功（200 OK）

**Content-Type**: 与 `targetFormat` 对应的 MIME 类型

| targetFormat | 响应 Content-Type |
| ------------- | ----------------- |
| `jpg` | `image/jpeg` |
| `png` | `image/png` |
| `webp` | `image/webp` |
| `gif` | `image/gif` |

**响应头**:

```
Content-Type: image/webp
Content-Length: 12345
X-Processor-Used: sharp | jimp | jimp (fallback: sharp)
```

**响应体**: 转换后图片的原始二进制内容（`ArrayBuffer`）

#### 错误响应

**Content-Type**: `application/json`

```typescript
// 错误响应体结构
interface ErrorResponse {
  error: string; // 人类可读的错误描述
}
```

| HTTP 状态码 | 触发条件 | `error` 示例 |
| ----------- | --------- | ------------ |
| `400` | 缺少 `file` 字段 | `"No image file uploaded"` |
| `400` | 缺少 `targetFormat` 字段 | `"No target format specified"` |
| `400` | `targetFormat` 不在支持列表 | `"Unsupported target format: bmp"` |
| `400` | 文件超过 10MB | `"File is too large. Maximum size is 10MB"` |
| `500` | 服务端转换异常（Sharp/Jimp 错误） | `"Failed to process image conversion"` |

### 处理器选择策略

后端根据源格式和目标格式自动选择处理器，调用方无需关心：

| 源格式 | 目标格式 | 处理器 | 备注 |
| -------- | --------- | -------- | ------ |
| JPEG/PNG | JPEG/PNG | Jimp（优先） | 失败时自动回退到 Sharp |
| 任意 | WebP/GIF | Sharp | — |
| 任意 | PNG/JPEG（当 Jimp 失败） | Sharp（fallback） | — |
