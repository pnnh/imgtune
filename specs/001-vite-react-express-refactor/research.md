# 技术研究报告：多平台架构重构

**关联 Plan**: [plan.md](./plan.md)
**生成日期**: 2026-08-05

---

## 研究 1：Vite 多构建目标方案

**决策**: 单 `vite.config.ts` + `VITE_BUILD_TARGET` 环境变量，区分 `web`（默认）、`extension`、`webview` 三个目标。

**理由**:

- 不使用多配置文件（`vite.config.web.ts` 等），避免重复配置维护
- 三个目标共享 99% 的配置（React、TypeScript、Tailwind），仅 `base`、PWA 插件和 `manifest.json` 复制逻辑不同
- `defineConfig` 支持函数形式接收 `mode` / 环境变量，天然适合此场景

**关键差异**:

| 构建目标 | `base` | PWA 插件 | `_locales` 复制 | 额外 `manifest.json` 复制 |
| --------- | -------- | --------- | ---------------- | -------------------------- |
| `web` | `/` | ✅ 启用 | ❌ | ❌ |
| `extension` | `./` | ❌ | ✅ | ✅（extension/manifest.json） |
| `webview` | `./` | ❌ | ❌ | ❌ |

**相对路径原因**: Chrome 扩展页面和 Webview 均可能通过 `chrome-extension://` 或 `file://` 加载，绝对路径 `/` 在这类协议下无法正确解析静态资产。

**备选方案（已否决）**: Vite Library 模式 / 多 `vite.config.ts` — 配置冗余，维护成本高。

---

## 研究 2：Chrome Extension Manifest V3 与 React 兼容性

**决策**: 采用 MV3（Manifest Version 3），使用 `action` 类型入口（Popup 页面），以 `index.html` 作为完整工具页面（`chrome.action.openOptionsPage` 或 `popup` 可选）。

**MV3 关键约束**:

- `background.scripts` → `background.service_worker`（Service Worker 模式，无持久状态）
- CSP 默认限制 `eval` 和内联脚本
- Vite 生产构建不使用 `eval`（无需修改 CSP）；开发环境需开发者自行处理

**React 19 兼容性**: ✅ React 生产包不使用 `eval`，与 MV3 CSP 天然兼容。

**推荐 manifest.json 结构**:

```json
{
  "manifest_version": 3,
  "name": "__MSG_siteName__",
  "description": "__MSG_siteDescription__",
  "version": "0.1.0",
  "default_locale": "en",
  "action": {
    "default_popup": "index.html",
    "default_icon": { "128": "icons/icon128.png" }
  },
  "permissions": [],
  "icons": { "128": "icons/icon128.png" }
}
```

`__MSG_key__` 语法引用 `_locales/*/messages.json`，Chrome 自动替换。

**备选方案（已否决）**: MV2 — Chrome Web Store 自 2024 年起对新提交强制要求 MV3。

---

## 研究 3：i18n chrome.i18n 适配器方案

**决策**: 实现 `src/client/i18n/adapter.ts` 统一接口，在 Chrome 扩展环境调用 `chrome.i18n.getMessage()`，在其他环境运行时加载 `_locales/{chromeLocale}/messages.json`。

**适配层接口**:

```typescript
// 统一消息获取函数签名
function getMessage(key: MessageKey): string
// 初始化（Web/PWA/Webview 环境需预加载）
async function loadMessages(appLocale: AppLocale): Promise<void>
```

**环境判断逻辑**:

```typescript
const isExtension = typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
if (isExtension) {
  return chrome.i18n.getMessage(key) || key;
} else {
  return cachedMessages[key]?.message ?? key;
}
```

**Web 环境预加载**:

- 在 React 应用初始化前（`main.tsx` 中的 `await loadMessages(detectedLocale)`）异步加载
- 若网络请求失败，降级使用内联的 `en` 语言包（编译时内嵌为 fallback）

**备选方案（已否决）**:

- i18next：功能完整但引入 ~30KB 额外体积，超出本项目需求
- 继续维护 `src/locales/*.json` 双套格式：违反 FR-015 / SC-007

---

## 研究 4：Chrome 扩展语言代码映射

**决策**: 维护一份 `APP_LOCALE → CHROME_LOCALE` 的映射表，作为 `_locales/` 目录命名的依据。

| 应用语言键（AppLocale） | Chrome 目录名 | Chrome 扩展支持 |
| ------------------------ | -------------- | ---------------- |
| `en` | `en` | ✅ |
| `es` | `es` | ✅ |
| `fr` | `fr` | ✅ |
| `de-DE` | `de` | ✅（Chrome 不支持 `de_DE`，仅支持 `de`） |
| `pt-PT` | `pt_PT` | ✅ |
| `ja` | `ja` | ✅ |
| `zh` | `zh_CN` | ✅ |
| `zh-TW` | `zh_TW` | ✅ |

**注意**: Chrome 要求 `default_locale` 必须在 `_locales/` 中存在对应目录；`de-DE` → `de` 的降级是必要的。

**对现有文案的影响**: 8 个语言文件均保留，仅格式（flat → `{message, description}` 嵌套）和目录结构需迁移，翻译内容不变。

---

## 研究 5：Express 自定义静态 Handler + SPA 路由 + runtime 参数处理

**决策**: 在 Express 中不使用裸 `express.static()`，改用自定义中间件链处理以下场景：

**处理顺序**:

```
请求进入
  ↓ 1. API 路由（/api/*）→ Express Router 处理
  ↓ 2. 静态资产检测（路径含文件扩展名 .js .css .png 等）→ 直接 sendFile
  ↓ 3. 携带 ?runtime=xxx 参数 → 读取参数值 → 设置 Cookie → 302 重定向至不含参数的 URL
  ↓ 4. 所有其余路径 → 返回 dist/index.html（SPA fallback）
```

**runtime 参数处理细节（解决 SC-008）**:

- Express 收到 `GET /?runtime=webview` → 设置 `Set-Cookie: imgtune-runtime=webview; SameSite=Lax; Path=/; Max-Age=3600` → 302 重定向到 `/`
- 前端 React 启动时读取 `imgtune-runtime` Cookie → 写入 `sessionStorage` → 清除 Cookie
- 此后 React Router 导航无需携带 `?runtime=` 参数

**SPA fallback**:

```typescript
// Express 路由注册顺序
app.use('/api', convertRouter);
app.use(customStaticMiddleware); // 静态资产（含 runtime param 302 处理）
app.get('*', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
```

**备选方案（已否决）**:

- 前端 JS 自行 `history.replaceState` 清除参数：URL 清洁行为发生在客户端，日志/分析中仍会记录脏 URL
- 直接使用 `express.static`：无法实现 SPA fallback 和 runtime 参数处理的组合逻辑

---

## 研究 6：React Router 在 Chrome 扩展中的使用

**决策**: 根据运行环境动态选择 Router 类型：Chrome 扩展使用 `HashRouter`，Web/PWA/Webview 使用 `BrowserRouter`。

**理由**:

- Chrome 扩展页面 URL 形如 `chrome-extension://{id}/index.html`，HTML5 History API 在此 URL 下无法工作（没有对应的服务端路由）
- `HashRouter` 在 `chrome-extension://` scheme 下完全正常，URL 形如 `chrome-extension://{id}/index.html#/home`
- Webview 嵌入时若使用 `file://` 协议加载，同样不适合 History API；若通过自定义协议或 localhost 加载，则可用 `BrowserRouter`

**实现策略**:

```typescript
// src/client/main.tsx
import { BrowserRouter, HashRouter } from 'react-router-dom';
const isExtension = typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
const Router = isExtension ? HashRouter : BrowserRouter;
```

**备选方案（已否决）**: 统一使用 HashRouter — URL 含 `#` 对网站/PWA SEO 不利；Lighthouse 评分会受影响。

---

## 研究 7：vite-plugin-pwa 配置策略

**决策**: 在 `web` 构建目标启用 `vite-plugin-pwa`，使用 `generateSW` 模式，Service Worker 缓存策略如下：

| 资源类型 | 策略 | 说明 |
| --------- | ------ | ------ |
| 前端静态资产（JS/CSS/字体） | `CacheFirst` | 文件名含 hash，安全长期缓存 |
| HTML（index.html） | `NetworkFirst` | 确保用户获得最新版本 |
| `/api/*` | `NetworkOnly` | 不缓存 POST 请求结果 |
| `/_locales/*` | `CacheFirst` | i18n 资源不频繁变动 |

**Web App Manifest 关键字段**:

```json
{
  "name": "ImgTune",
  "short_name": "ImgTune",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff"
}
```

**Lighthouse 达标关键点**: 提供 192×192 和 512×512 图标、HTTPS 部署（Cloudflare 自动提供）、`display: standalone`。

---

## 研究 8：Cloudflare Container 与 Express.js 兼容性

**决策**: Express.js 完全兼容现有 Cloudflare Container 架构，改动最小。

**兼容性确认**:

- Cloudflare Container 运行标准 Docker 镜像（Node.js 22），Express.js 在此环境无任何限制
- Worker 代理逻辑（`worker.ts`）将所有请求转发到 Container，不关心内部实现是 Next.js 还是 Express
- Container 端口（3000）与 `wrangler.jsonc` 配置一致，无需修改

**Dockerfile 更新要点**:

- Stage 1（deps）：安装依赖，包括 Sharp 的原生二进制（需要 `--platform linux/amd64`）
- Stage 2（builder）：运行前端 Vite 构建（`pnpm build:web`）并编译后端 TypeScript
- Stage 3（runner）：仅复制 `dist/`（前端产物）、`dist-server/`（后端编译产物）和 `node_modules`

**关键注意**: Sharp 依赖原生 C++ addon，Dockerfile 中需确保 `npm rebuild sharp` 在 `linux/amd64` 架构下执行（与现有 Next.js Dockerfile 策略一致）。

---

## 所有 NEEDS CLARIFICATION 已解决

Phase 0 结论：技术方案清晰，所有原有的 NEEDS CLARIFICATION 项已通过研究或 spec clarify 会话解决，无阻塞项。可进入 Phase 1。
