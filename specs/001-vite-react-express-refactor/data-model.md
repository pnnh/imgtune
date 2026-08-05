# 数据模型：多平台架构重构

**关联 Plan**: [plan.md](./plan.md)
**生成日期**: 2026-08-05

---

## 实体 1：RuntimeContext（运行环境上下文）

描述前端当前所处的宿主环境，是控制功能可见性的核心依据。

| 字段 | 类型 | 说明 |
| ------ | ------ | ------ |
| `type` | `'web' \| 'pwa' \| 'extension' \| 'webview'` | 宿主类型 |
| `hasBackend` | `boolean` | 是否可访问 Express API（web/pwa 为 true，其余为 false） |
| `baseUrl` | `string \| null` | API 请求基础 URL（无后端时为 null） |

**检测优先级**（从高到低）：

| 优先级 | 条件 | 结果 |
| -------- | ------ | ------ |
| 1 | `typeof chrome !== 'undefined' && !!chrome?.runtime?.id` | `extension` |
| 2 | Cookie `imgtune-runtime=webview`（由 Express 重定向时设置） | `webview` |
| 3 | `window.matchMedia('(display-mode: standalone)').matches` | `pwa` |
| 4 | 无匹配条件 | `web` |

**衍生规则**：

- `extension` 或 `webview` → `hasBackend = false`
- `web` 或 `pwa` → `hasBackend = true`

**持久化**：检测结果存入 React Context，整个会话有效；不持久化到 localStorage（避免跨会话污染）。

---

## 实体 2：PlatformCapabilities（平台能力配置）

由 `RuntimeContext` 导出的功能开关映射，供 UI 组件通过 hook 消费。

| 字段 | 类型 | 说明 |
| ------ | ------ | ------ |
| `canConvertImages` | `boolean` | 是否显示图片格式转换功能入口（需后端 Sharp API） |
| `canInstallPwa` | `boolean` | 是否显示 PWA 安装提示（仅 web 运行时） |
| `router` | `'browser' \| 'hash'` | 前端路由类型（扩展使用 hash，其余使用 browser） |

**映射关系**：

| RuntimeContext | `canConvertImages` | `canInstallPwa` | `router` |
| --------------- | ------------------- | ----------------- | ---------- |
| `web` | `true` | `true` | `browser` |
| `pwa` | `true` | `false` | `browser` |
| `extension` | `false` | `false` | `hash` |
| `webview` | `false` | `false` | `browser` |

---

## 实体 3：ImageConversionTask（图片转换任务）

描述一次图片转换请求的输入和状态，对应 POST `/api/convert` 的请求载荷。

| 字段 | 类型 | 必填 | 约束 |
| ------ | ------ | ------ | ------ |
| `file` | `File` | ✅ | 大小 ≤ 10MB，MIME 类型须为 `image/*` |
| `targetFormat` | `'jpg' \| 'png' \| 'webp' \| 'gif'` | ✅ | — |
| `quality` | `number` | ❌ | 1–100，默认 80（仅 JPEG/WebP 有效） |
| `compressionLevel` | `number` | ❌ | 0–9，默认 6（仅 PNG 有效） |
| `lossless` | `boolean` | ❌ | 默认 false（仅 WebP 有效） |

**状态机**：

```
idle → uploading → processing → success
                              → error
```

**错误类型**：

- `FILE_TOO_LARGE`: 文件超过 10MB
- `UNSUPPORTED_FORMAT`: 文件 MIME 类型不在支持列表中
- `CONVERSION_FAILED`: 服务端 Sharp/Jimp 处理异常
- `NETWORK_ERROR`: 请求网络失败

---

## 实体 4：i18n 消息（Chrome 扩展格式）

单条翻译消息的数据结构，遵循 Chrome 扩展 `_locales/*/messages.json` 规范。

```typescript
// 每条消息的结构
interface ChromeI18nMessage {
  message: string;        // 消息文本，可含 $1 $2 等占位符
  description?: string;   // 可选，向翻译人员说明上下文
}

// 每个 _locales/*/messages.json 文件的顶层结构
type MessagesFile = Record<MessageKey, ChromeI18nMessage>;
```

**MessageKey 枚举**（来自现有 `src/locales/en.json`，共 28 个键）：

- `siteName`, `siteTagline`, `siteDescription`
- `homeTitle`, `homeDescription`
- `changeLanguage`, `dragDropText`, `supportedFormats`
- `selectTargetFormat`, `conversionParameters`
- `quality`, `compressionLevel`, `lossless`, `defaultSettings`
- `convertButton`, `converting`, `conversionSuccess`, `conversionFailed`
- `originalPreview`, `convertedPreview`, `downloadButton`
- `fileSize`, `dimensions`, `closePreview`, `savedSize`

---

## 实体 5：AppLocale → ChromeLocale 映射

维护应用层语言键和 Chrome 扩展目录名的双向映射。

| AppLocale（应用层语言键） | ChromeLocale（`_locales/` 目录名） | 备注 |
| -------------------------- | ----------------------------------- | ------ |
| `en` | `en` | — |
| `es` | `es` | — |
| `fr` | `fr` | — |
| `de-DE` | `de` | Chrome 不支持 `de_DE`，降级为 `de` |
| `pt-PT` | `pt_PT` | 下划线分隔 |
| `ja` | `ja` | — |
| `zh` | `zh_CN` | 简体中文 |
| `zh-TW` | `zh_TW` | 繁體中文 |

**状态迁移路径**：

1. 现有 `src/locales/{appLocale}.json`（flat 格式）→ `_locales/{chromeLocale}/messages.json`（嵌套格式）
2. 每个翻译键值从 `"key": "value"` 迁移为 `"key": { "message": "value" }`
3. 共 8 个文件，28 个键，无翻译内容变更

---

## 验证规则汇总

| 规则 | 适用实体 | 描述 |
| ------ | --------- | ------ |
| 文件大小 ≤ 10MB | ImageConversionTask | 前端和后端双重校验 |
| MIME 必须为 image/* | ImageConversionTask | 前端 `accept="image/*"` + 后端白名单 |
| quality 范围 1–100 | ImageConversionTask | 后端 `Math.min(100, Math.max(1, ...))` 保守解析 |
| compressionLevel 范围 0–9 | ImageConversionTask | 同上 |
| MessageKey 必须存在于 en 字典 | i18n 消息 | TypeScript 类型系统保证（编译时检查） |
| `_locales/en/` 必须存在 | AppLocale 映射 | Chrome 扩展 `default_locale: "en"` 要求 |
