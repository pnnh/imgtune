---
description: "Task list template for feature implementation"
---

# 任务清单：多平台架构重构（Vite+React + Express.js）

**Input**: Design documents from `/specs/001-vite-react-express-refactor/`

**Prerequisites**: plan.md ✅，spec.md ✅，research.md ✅，data-model.md ✅，contracts/ ✅

**测试**: 本 spec 未要求 TDD，不生成测试任务（按需在 Polish 阶段补充）

**组织方式**: 任务按用户故事分组，每个故事可独立实现和测试

---

## Phase 1：项目初始化（Setup）

**目标**: 移除 Next.js，搭建 Vite + React + Express 基础构建环境

- [X] T001 更新 package.json — 移除 next；添加前端依赖 vite、@vitejs/plugin-react、@tailwindcss/vite、react-router-dom、vite-plugin-pwa；添加后端依赖 express、multer、tsx；添加类型声明 @types/express、@types/multer；`package.json`
- [X] T002 [P] 创建 tsconfig.server.json — Node.js 22 目标，moduleResolution NodeNext，outDir dist-server，include 仅包含 src/server；`tsconfig.server.json`
- [X] T003 更新 tsconfig.json — 调整 paths（@/ 指向 src/client/），target ESNext，移除 next 相关 moduleResolution 插件配置；`tsconfig.json`
- [X] T004 创建 index.html — Vite 前端入口 HTML，包含 `<div id="root">` 和 `<script type="module" src="/src/client/main.tsx">`；`index.html`
- [X] T005 创建 vite.config.ts — 含 @vitejs/plugin-react、@tailwindcss/vite、path alias（@ → src/client/）、VITE_BUILD_TARGET 读取框架（暂 web 占位，后续 US2/US3/US4 逐步补充各目标）；`vite.config.ts`
- [X] T006 [P] 删除 postcss.config.mjs — Tailwind v4 改为 @tailwindcss/vite 插件模式，不再需要独立 PostCSS 配置；`postcss.config.mjs`

---

## Phase 2：基础架构（Foundational）

**目标**: i18n 格式迁移、RuntimeContext 检测、Router 选择逻辑——所有用户故事共同依赖的前置条件

**独立可测标准**: `pnpm build:web`（Phase 3 补充脚本后）可成功编译，浏览器加载构建产物无 console 错误

- [X] T007 创建 _locales/ 翻译目录 — 将 src/locales/ 下 8 个 JSON 文件迁移至 Chrome 扩展格式：flat `"key":"value"` → `"key":{"message":"value"}`，按 research.md 映射重命名目录（zh → zh_CN，de-DE → de，pt-PT → pt_PT，zh-TW → zh_TW）；`_locales/en/messages.json`、`_locales/zh_CN/messages.json`（及另 6 个语言目录）
- [X] T008 [P] 创建 src/client/i18n/types.ts — 定义 MessageKey 联合类型（28 个键，来自现有 src/locales/en.json），AppLocale 类型，LOCALE_MAP 常量（AppLocale → ChromeLocale 目录名映射）；`src/client/i18n/types.ts`
- [X] T009 [P] 创建 src/client/i18n/adapter.ts — 实现 getMessage(key: MessageKey): string 和 async loadMessages(locale: AppLocale): Promise<void>；Chrome 扩展环境走 chrome.i18n.getMessage()，其他环境 fetch `/_locales/{chromeLocale}/messages.json`，内嵌 en fallback；`src/client/i18n/adapter.ts`
- [X] T010 [P] 创建 src/client/i18n/detector.ts — 语言检测函数 detectLocale(): AppLocale，优先级：① chrome.i18n.getUILanguage()（扩展） → ② localStorage 'imgtune-locale' → ③ navigator.language（规范化匹配） → ④ 'en'；`src/client/i18n/detector.ts`
- [X] T011 创建 src/client/runtime/detect.ts — detectRuntimeContext() 函数，4 级优先级检测：① chrome.runtime.id → extension；② document.cookie imgtune-runtime=webview → webview（写入 sessionStorage，清除 Cookie）；③ display-mode standalone → pwa；④ → web；`src/client/runtime/detect.ts`
- [X] T012 创建 src/client/runtime/context.tsx — 定义 RuntimeContext 和 PlatformCapabilities 类型，实现 computeCapabilities(ctx) 映射函数，RuntimeProvider 组件，useRuntime() hook；`src/client/runtime/context.tsx`
- [X] T013 创建 src/client/App.tsx — 根组件：根据 PlatformCapabilities.router 动态选择 BrowserRouter/HashRouter，包裹 RuntimeProvider，定义根路由 / 指向 Home 页面；`src/client/App.tsx`
- [X] T014 创建 src/client/main.tsx — 应用入口：① detectLocale() → ② await loadMessages(locale) → ③ detectRuntimeContext() → ④ ReactDOM.createRoot('#root').render(<App />)；`src/client/main.tsx`

---

## Phase 3：[US1] 网站/PWA 完整图片转换功能（P1）

**故事目标**: 用户在网站或 PWA 环境中完整使用图片格式转换（JPG/PNG/WebP/GIF 互转），Express 后端调用 Sharp/Jimp 处理，支持 PWA 离线安装

**独立可测标准**: `pnpm dev` 后访问 localhost:3000，上传 PNG 转 WebP 可成功下载；Lighthouse PWA 审计 ≥ 90 分（SC-003、SC-004）

- [X] T015 [P] [US1] 创建 src/server/middleware/upload.ts — multer memoryStorage 配置，limits: {fileSize: 10 *1024* 1024}，fileFilter 限制 MIME 为 image/jpeg、image/png、image/webp、image/gif；`src/server/middleware/upload.ts`
- [X] T016 [P] [US1] 创建 src/server/routes/convert.ts — 将 src/app/api/convert/route.ts 中的 Sharp/Jimp 处理逻辑迁移为 Express Router；multer.single('file') 中间件；保留处理器选择策略（Jimp 优先 JPEG/PNG，Sharp 处理 WebP/GIF）；返回二进制 Buffer 和正确 Content-Type；`src/server/routes/convert.ts`
- [X] T017 [P] [US1] 创建 src/server/routes/static.ts — 自定义静态资产中间件：路径含文件扩展名则 sendFile，否则返回 dist/index.html（SPA fallback）；runtime Cookie 逻辑预留空函数占位（US3 补充）；`src/server/routes/static.ts`
- [X] T018 [US1] 创建 src/server/index.ts — Express app 组装：挂载 /api/convert 路由（T016）、静态资产路由（T017）、全局错误处理中间件（返回 JSON 错误体）、监听 process.env.PORT ?? 3000；`src/server/index.ts`
- [X] T019 [P] [US1] 创建 src/client/components/SiteHeader.tsx — 迁移自 src/components/SiteHeader.tsx，使用 getMessage() 替换 t() 调用，保留 LanguageSelector 集成；`src/client/components/SiteHeader.tsx`
- [X] T020 [P] [US1] 创建 src/client/components/SiteFooter.tsx — 迁移自 src/components/SiteFooter.tsx，使用 getMessage() 替换 t() 调用；`src/client/components/SiteFooter.tsx`
- [X] T021 [P] [US1] 创建 src/client/components/LanguageSelector.tsx — 迁移自 src/components/LanguageSelector.tsx；语言切换时调用 loadMessages(newLocale) 并写入 localStorage 'imgtune-locale'；`src/client/components/LanguageSelector.tsx`
- [X] T022 [US1] 创建 src/client/components/ImageConverter.tsx — 迁移自 src/components/ImageConverter.tsx；消费 useRuntime().capabilities.canConvertImages 控制格式选择区、转换按钮、结果预览区的显示与隐藏；API 请求目标改为 /api/convert；`src/client/components/ImageConverter.tsx`
- [X] T023 [US1] 创建 src/client/pages/Home.tsx — 首页：组合 SiteHeader、ImageConverter（canConvertImages 控制内容）、SiteFooter；`src/client/pages/Home.tsx`
- [X] T024 [US1] 更新 vite.config.ts — 为 web 构建目标添加 vite-plugin-pwa：generateSW 模式，globPatterns 覆盖 js/css/html/png，runtimeCaching 中 /api/* 走 NetworkOnly，index.html 走 NetworkFirst，静态资产走 CacheFirst；manifest 含 name/short_name/start_url/display/icons；`vite.config.ts`
- [X] T025 [P] [US1] 添加 PWA 及扩展图标 — 在 public/icons/ 下放置 icon-192.png（192×192）、icon-512.png（512×512）、icon128.png（128×128）三个 PNG 图标文件；`public/icons/`
- [X] T026 [US1] 更新 Dockerfile — 三阶段构建：Stage 1 pnpm install，Stage 2 分别执行 pnpm build:web（Vite）和 pnpm build:server（tsc），Stage 3 仅复制 dist/（前端）、dist-server/（后端）、production node_modules；保留 sharp --rebuild 原生依赖重编译步骤；`Dockerfile`
- [X] T027 [US1] 更新 package.json scripts — 添加 dev（concurrently 同时启动 vite dev server 和 tsx watch src/server/index.ts）、build:web（VITE_BUILD_TARGET=web vite build）、build:server（tsc -p tsconfig.server.json）、preview（vite preview）；`package.json`

---

## Phase 4：[US2] Chrome 扩展前端独立运行（P2）

**故事目标**: 前端以 Chrome MV3 扩展形式打包，服务端功能入口（图片转换）在扩展界面不可见，无网络环境可正常渲染

**独立可测标准**: `pnpm build:extension` 产出 dist-ext/，在 chrome://extensions 加载后打开界面，确认格式转换入口不存在（DOM 中 [data-requires-backend] 元素缺席）（SC-001、SC-002）

- [X] T028 [P] [US2] 创建 extension/manifest.json — MV3：manifest_version:3，name:"**MSG_siteName**"，description:"**MSG_siteDescription**"，version:"0.1.0"，default_locale:"en"，action:{default_popup:"index.html"，default_icon:{128:"icons/icon128.png"}}，permissions:[]；`extension/manifest.json`
- [X] T029 [US2] 更新 vite.config.ts — 添加 extension 构建目标（VITE_BUILD_TARGET=extension）：base='./'，outDir=dist-ext，关闭代码分割（manualChunks:undefined），使用 vite-plugin-static-copy 将 _locales/ 和 extension/manifest.json 复制到 dist-ext/；`vite.config.ts`
- [X] T030 [US2] 更新 package.json scripts — 添加 build:extension（VITE_BUILD_TARGET=extension vite build）；`package.json`
- [X] T031 [US2] 创建 src/client/globals.css — 迁移自 src/app/globals.css，将 @tailwind 指令替换为 Tailwind v4 的 @import "tailwindcss"，移除 @next 特定 CSS 变量，在 src/client/main.tsx 中导入；`src/client/globals.css`

---

## Phase 5：[US3] Webview 嵌入支持（P3）

**故事目标**: Express 正确处理 ?runtime=webview 参数（设置 Cookie + 302 重定向），前端初始化读取 Cookie 识别 webview 环境并隐藏服务端功能；提供 webview 独立静态资产构建目标

**独立可测标准**: 访问 <http://localhost:3000/?runtime=webview> → 302 重定向到 / → DevTools Application > sessionStorage 中 imgtune-runtime='webview' → 格式转换入口不可见（SC-008、FR-013）

- [X] T032 [US3] 更新 src/server/routes/static.ts — 补全 runtime 参数处理：在自定义 handler 最前端检测 req.query.runtime，若存在则设置 Set-Cookie: imgtune-runtime={value}; SameSite=Lax; Path=/; Max-Age=3600，302 重定向至不含 runtime 参数的同路径 URL；`src/server/routes/static.ts`
- [X] T033 [US3] 更新 src/client/runtime/detect.ts — 补全 Cookie 读取分支：在 detectRuntimeContext() 中解析 document.cookie 提取 imgtune-runtime 值，写入 sessionStorage('imgtune-runtime')，立即清除 Cookie（document.cookie = 'imgtune-runtime=; Max-Age=0; Path=/'）；`src/client/runtime/detect.ts`
- [X] T034 [US3] 更新 vite.config.ts — 添加 webview 构建目标（VITE_BUILD_TARGET=webview）：base='./'，outDir=dist-webview，不启用 vite-plugin-pwa；`vite.config.ts`
- [X] T035 [US3] 更新 package.json scripts — 添加 build:webview（VITE_BUILD_TARGET=webview vite build）；`package.json`

---

## Phase 6：[US4] Cloudflare Worker + Container 部署（P4）

**故事目标**: `pnpm deploy` 一键完成前后端构建并部署到 Cloudflare，Express Container 正常响应 Worker 代理的所有请求

**独立可测标准**: `pnpm cf:preview`（wrangler dev）后，GET / 返回 index.html，POST /api/convert 返回转换后图片（SC-005）

- [X] T036 [US4] 更新 package.json scripts — 添加 build（pnpm build:web && pnpm build:server）、deploy（pnpm build && wrangler deploy）；`package.json`
- [X] T037 [P] [US4] 审查 worker.ts — 验证 defaultPort=3000 与 Express 监听端口一致，sleepAfter="5m" 策略保持不变，添加注释说明 Express 替换 Next.js 后 Worker 代理逻辑无需修改；`worker.ts`
- [X] T038 [P] [US4] 审查 wrangler.jsonc — 确认 containers[].image 指向更新后的 Dockerfile，durable_objects 绑定和 migrations 配置无需变更，添加注释说明验证状态；`wrangler.jsonc`

---

## Phase 7：清理收尾（Polish）

**目标**: 删除旧 Next.js 文件，确保项目目录整洁，无遗留的无用代码

- [X] T039 [P] 删除旧 Next.js 源码 — 删除 src/app/（App Router 全部文件）、src/components/（已迁移的旧组件）、src/lib/（旧 i18n.ts 和 language.ts）；`src/app/`、`src/components/`、`src/lib/`
- [X] T040 [P] 删除旧配置文件 — 删除 next.config.ts、next-env.d.ts；`next.config.ts`、`next-env.d.ts`
- [X] T041 确认后删除 src/locales/ — 确认 _locales/ 下 8 个语言目录的翻译内容与原 src/locales/ 完全一致后删除旧目录；`src/locales/`

---

## 依赖图

```
Phase 1: Setup（T001–T006）
  └─▶ Phase 2: Foundational（T007–T014）—— 依赖 T001（依赖安装）、T003（tsconfig paths）
        ├─▶ Phase 3: US1（T015–T027）—— 依赖 Phase 2 全部（尤其 T011–T014 runtime/i18n）
        ├─▶ Phase 4: US2（T028–T031）—— 依赖 Phase 2 全部（T011、T012 runtime context）
        ├─▶ Phase 5: US3（T032–T035）—— 依赖 Phase 3（T017 static.ts 基础、T018 server/index.ts）
        └─▶ Phase 6: US4（T036–T038）—— 依赖 Phase 3（T026 Dockerfile、T027 scripts）
              └─▶ Phase 7: Polish（T039–T041）—— 依赖所有 Phase 完成后执行
```

**User Story 间依赖**:

- US1（P1）与 US2（P2）**可并行**推进（共享 Phase 2，实现各自 Phase 互不依赖）
- US3（P3）**依赖** US1 的 T017（static.ts 基础实现）和 T018（server/index.ts）
- US4（P4）**依赖** US1 的 T026（Dockerfile）和 T027（build scripts）

---

## 并行执行示例

**Phase 2 内最大并行组**（T007 完成后）:

```
T008（i18n/types.ts） ‖ T009（i18n/adapter.ts） ‖ T010（i18n/detector.ts）
```

**Phase 3 US1 内并行组**:

```
T015（upload 中间件） ‖ T016（convert 路由） ‖ T017（static 路由）
T019（SiteHeader） ‖ T020（SiteFooter） ‖ T021（LanguageSelector） ‖ T025（图标资产）
```

**Phase 4/5/6 内可并行（US2 与 US3 均依赖 Phase 3 完成）**:

```
[US2] T028（manifest） ‖ [US3] T034（vite webview config）
[US4] T037（worker.ts 审查） ‖ T038（wrangler.jsonc 审查）
```

---

## 实现策略（MVP 优先）

**推荐 MVP 范围（仅 US1）**: 完成 Phase 1 → Phase 2 → Phase 3（T001–T041 中的 T001–T027），即可获得可运行的 Web 版本 + PWA，验证重构成功后再推进扩展和 Webview 支持。

| 阶段 | 范围 | 可交付成果 |
| ------ | ------ | ---------- |
| MVP | Phase 1–3（T001–T027） | 可运行的 Web 网站 + PWA 安装支持 |
| 扩展 | Phase 4（T028–T031） | Chrome 扩展包可加载 |
| Webview | Phase 5（T032–T035） | Webview 嵌入协议工作 |
| 部署 | Phase 6（T036–T038） | Cloudflare 部署验证 |
| 收尾 | Phase 7（T039–T041） | 旧文件清理完毕 |
