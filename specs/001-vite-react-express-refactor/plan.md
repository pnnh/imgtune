# 实现计划：多平台架构重构（Vite+React + Express.js）

**Branch**: `001-vite-react-express-refactor` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-vite-react-express-refactor/spec.md`

## 摘要

将 Next.js App Router 单体项目拆分为 Vite+React 纯静态前端 + Express.js 后端，支持网站/PWA、Chrome 扩展（MV3）、桌面 Webview 三种前端运行形式，以及 Cloudflare Worker+Container 部署。前端通过运行时环境检测（`RuntimeContext`）动态控制功能可用性；i18n 迁移至 Chrome 扩展标准格式（`_locales/*/messages.json`）以支持扩展原生 API 和 Web 适配层共享同一套翻译数据。

## 技术上下文

**语言/版本**: TypeScript 5.x，Node.js 22（Docker / Cloudflare Container）

**主要依赖**:

- 前端: Vite 6、React 19、react-router v6、vite-plugin-pwa
- 后端: Express.js 5.x、Sharp 0.34+、Jimp 1.6+、multer（文件上传中间件）
- 构建工具: Vite（多目标构建，通过 `VITE_BUILD_TARGET` 环境变量区分 `web/extension/webview`）

**存储**: N/A（无状态，纯请求-响应模式）

**测试**: Vitest（前端单元测试，主要覆盖运行时检测和 i18n 适配器）

**目标平台**:

- 网站/PWA: 现代主流浏览器（Chrome 116+、Firefox 120+、Safari 17+）
- Chrome 扩展: Chrome 116+（Manifest V3）
- 后端: Node.js 22（Docker，Cloudflare Container）

**项目类型**: web-service + browser-extension + static-webapp

**性能目标**: API 转换 p95 < 500ms（10MB 以内图片）；PWA Lighthouse 审计 ≥ 90 分

**约束**:

- 文件上传上限 10MB（与现有实现一致）
- API 接口无鉴权（公开小工具策略不变）
- Chrome 扩展 MV3 CSP 限制：禁止 `eval`（Vite 生产构建天然满足，无需额外配置）
- 扩展构建和 Webview 构建的 Vite base 路径须为 `./`（相对路径），Web 构建为 `/`

**规模/范围**: 单 Container 实例，不考虑高并发扩容

## Constitution Check

*GATE: 规划前必须通过，Phase 1 设计完成后再次核查*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 文档语言规范（NON-NEGOTIABLE） | ✅ 通过 | 本 plan 全程使用简体中文，技术标识符保持英文 |

*Phase 1 后复查：无设计决策违反上述原则*

## 项目结构

### 规划文档（本功能）

```text
specs/001-vite-react-express-refactor/
├── plan.md         # 本文件
├── research.md     # Phase 0 产出
├── data-model.md   # Phase 1 产出
├── quickstart.md   # Phase 1 产出
├── contracts/      # Phase 1 产出
│   ├── api.md
│   ├── runtime.md
│   └── i18n.md
└── tasks.md        # Phase 2 产出（/speckit.tasks 命令生成）
```

### 源代码目录（项目根）

```text
src/
├── client/                     # Vite+React 前端源码
│   ├── main.tsx                # 入口，运行时检测，Router 选择
│   ├── App.tsx                 # 根组件
│   ├── runtime/
│   │   ├── detect.ts           # RuntimeContext 检测逻辑
│   │   └── context.tsx         # React Context Provider
│   ├── i18n/
│   │   ├── adapter.ts          # chrome.i18n / web 适配层
│   │   ├── detector.ts         # 语言检测（navigator.language + cookie）
│   │   └── types.ts            # MessageKey 类型，LocaleCode 映射
│   ├── components/
│   │   ├── ImageConverter.tsx  # 核心转换组件（迁移自现有实现）
│   │   ├── LanguageSelector.tsx
│   │   ├── SiteHeader.tsx
│   │   └── SiteFooter.tsx
│   └── pages/
│       └── Home.tsx
├── server/                     # Express.js 后端源码
│   ├── index.ts                # Express app + server 入口
│   ├── routes/
│   │   ├── convert.ts          # POST /api/convert（迁移自 Next.js route.ts）
│   │   └── static.ts           # 自定义静态资产 handler + SPA fallback
│   └── middleware/
│       └── upload.ts           # multer 文件上传中间件配置
│
_locales/                       # Chrome 扩展标准 i18n 格式（根目录，三种构建共用）
├── en/messages.json
├── zh_CN/messages.json
├── zh_TW/messages.json
├── de/messages.json
├── es/messages.json
├── fr/messages.json
├── ja/messages.json
└── pt_PT/messages.json
│
extension/
└── manifest.json               # Chrome Extension MV3 manifest
│
public/                         # 静态资产（favicon、PWA icons 等）
index.html                      # Vite 前端入口 HTML
vite.config.ts                  # 前端多目标构建配置（读取 VITE_BUILD_TARGET）
tsconfig.json                   # 前端 TypeScript 配置
tsconfig.server.json            # 后端 TypeScript 配置（Node.js target）
Dockerfile                      # 更新为 Express 构建流程
worker.ts                       # Cloudflare Worker 代理（不变）
wrangler.jsonc                  # Cloudflare 配置（更新端口为 3000）
```

**结构决策**：采用单包结构（非 monorepo），保持现有 `package.json` 根文件，前后端源码分别位于 `src/client/` 和 `src/server/`，共享根目录下的 `_locales/`。理由：项目规模小，monorepo 会带来不必要的工具链复杂度；单包便于 `pnpm deploy` 一键构建。
