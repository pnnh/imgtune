# Feature Specification: 多平台架构重构（Vite+React + Express.js）

**Feature Branch**: `001-vite-react-express-refactor`

**Created**: 2026-08-05

**Status**: Draft

**Input**: 将现有 Next.js 图片转换工具重构为 Vite+React 前端 + Express.js 后端的多平台方案，支持 Chrome 扩展、桌面 Webview 嵌入、传统网站/PWA、以及 Cloudflare Worker 部署。

---

## Clarifications

### Session 2026-08-05

- Q: Webview 运行环境检测方式 → A: URL 参数检测（`?runtime=webview`）；Express 生产环境须使用自定义静态资产 handler（不能直接使用 `express.static`）以在提供前端资源时剥离该参数，使 URL 保持简洁；Express 同时须对所有非 API 及非静态资产路径返回 `index.html` 以支持 SPA 客户端路由（如 react-router）。
- Q: 多语言 i18n 翻译文案的存储格式 → A: 统一调整为 Chrome 扩展标准格式（`_locales/[lang]/messages.json`）；在 Chrome 扩展环境使用原生 `chrome.i18n` API；在网站/PWA/Webview 等其他环境通过前端适配层加载同一套文件，无需维护双套翻译。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 网站/PWA 用户使用完整图片转换功能（Priority: P1）

访问网站的普通用户，或已将网站以 PWA 形式安装到桌面的用户，可以上传图片并使用包括 Sharp 在内的全部图片转换功能（JPG / PNG / WebP / GIF 互转），转换完成后下载结果文件。

**Why this priority**: 这是项目的核心使用场景，覆盖现有功能和最大用户群体。确保重构后核心功能不退化。

**Independent Test**: 在标准浏览器中访问部署后的网站，上传一张 PNG 并转换为 WebP，可成功下载转换后文件。PWA 安装后在 standalone 模式下重复同样操作。

**Acceptance Scenarios**:

1. **Given** 用户在浏览器中访问网站，**When** 用户上传一张图片并选择目标格式点击转换，**Then** 后端处理完成后用户可下载转换后的图片。
2. **Given** 用户已将网站安装为 PWA，**When** 用户在 standalone 模式下执行相同操作，**Then** 功能与普通网站模式完全一致。
3. **Given** 网络请求失败，**When** 用户提交转换，**Then** 界面显示友好的错误提示，不崩溃。

---

### User Story 2 - Chrome 扩展用户使用前端独立功能（Priority: P2）

将前端打包为 Chrome 浏览器扩展并安装的用户，可以打开扩展界面使用不依赖后端服务的图片处理功能。需要 Sharp 服务端支持的功能入口不可见。

**Why this priority**: 验证前端可完全脱离后端独立运行，Chrome 扩展是独立分发的重要渠道。

**Independent Test**: 将前端以 Chrome 扩展形式加载到浏览器，打开扩展 Popup 或全屏页，确认服务端相关功能入口不显示，其余界面正常可用。

**Acceptance Scenarios**:

1. **Given** 扩展已安装，**When** 用户打开扩展界面，**Then** 所有需要服务端的功能入口（如 Sharp 处理的格式转换选项）均不显示。
2. **Given** 扩展已安装，**When** 用户与可用的前端功能交互，**Then** 功能正常响应，不出现与后端通信的尝试。
3. **Given** 扩展在无网络环境下打开，**When** 用户使用可用功能，**Then** 功能仍正常运行。

---

### User Story 3 - 桌面原生应用通过 Webview 嵌入前端（Priority: P3）

桌面原生应用（如 Electron / Tauri / 系统 WebView）将前端作为静态资产嵌入，用户在 Webview 中使用图片工具。与 Chrome 扩展类似，服务端相关功能入口不可见，前端独立运行。

**Why this priority**: 为未来桌面应用集成提供架构基础，前端需支持零后端依赖的运行模式。

**Independent Test**: 通过本地 `file://` 或 Webview 容器加载前端静态资产，验证服务端功能入口隐藏，界面可正常渲染和交互。

**Acceptance Scenarios**:

1. **Given** 原生应用在加载 Webview 时于入口 URL 附加 `?runtime=webview`，**When** 前端初始化，**Then** 读取该参数并确定为 Webview 环境，隐藏服务端功能入口。
2. **Given** 前端以静态文件形式加载（无服务器），**When** 用户交互时，**Then** 不发出任何 API 请求，不出现网络错误。

---

### User Story 4 - 开发者部署到 Cloudflare Worker + Container（Priority: P4）

开发者通过现有 Cloudflare 部署流程，将 Express.js 服务部署到 Cloudflare Container，Worker 作为入口代理流量。Express 同时承担静态资产路由和 API 路由。

**Why this priority**: 保持现有部署路径，确保重构后项目仍可通过 Cloudflare 对外发布。

**Independent Test**: 执行部署命令后，通过 Worker 域名访问网站，静态资产加载正常，图片转换 API 响应正常。

**Acceptance Scenarios**:

1. **Given** 已执行部署命令，**When** 通过 Cloudflare Worker 域名访问，**Then** Express 提供的前端静态资产正常加载。
2. **Given** 部署完成，**When** 前端调用图片转换 API，**Then** Express API 正确处理请求并返回结果。

---

### Edge Cases

- 用户在网站环境下上传超大文件（超过合理限制），系统如何处理？
- 前端在运行环境信号不明确时（无 `?runtime=` 参数、非 Chrome 扩展、非 PWA standalone 模式），默认按 `web` 模式运行，展示全部功能（假设后端可用）。
- 多语言支持在三种打包产物（网站/扩展/独立前端）中均需保留。
- Chrome 扩展打包时，`manifest.json` 的权限声明需与实际功能一致。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 前端必须基于 Vite+React 构建，产出纯静态资产，不依赖任何 SSR 运行时。
- **FR-002**: 后端必须基于 Express.js 提供图片处理 API（复用现有 Sharp/Jimp 能力），并提供静态资产路由。
- **FR-003**: 前端必须在运行时感知当前宿主环境（网站/PWA/Chrome 扩展/Webview），并据此控制功能入口的显示与隐藏。
- **FR-004**: 需要服务端支持的功能入口（如 Sharp 处理的格式转换）在 Chrome 扩展和 Webview 环境下必须完全隐藏。
- **FR-005**: 前端静态资产必须能在不连接任何后端的情况下独立渲染和运行（Chrome 扩展、Webview 场景）。
- **FR-006**: 网站必须支持 PWA 安装，包含 Web App Manifest 和 Service Worker，用户可将其添加到桌面。
- **FR-007**: 前端必须能打包为 Chrome 浏览器扩展，具备独立的 `manifest.json`，可上架 Chrome Web Store。
- **FR-008**: 前端静态资产必须能作为独立文件集被原生应用 Webview 加载，无需配置服务器。
- **FR-009**: Express.js 服务必须能部署到 Cloudflare Container，并与现有 Worker 代理架构兼容。
- **FR-010**: 现有全部图片格式转换功能（JPG/PNG/WebP/GIF 互转）在网站和 PWA 场景下必须完整保留。
- **FR-011**: 现有多语言支持必须在所有运行形式中保留。
- **FR-012**: Webview 运行环境通过 URL 参数识别：原生应用在加载 Webview 时于入口 URL 附加 `?runtime=webview`；前端初始化时读取该参数并持久化宿主环境状态（整个会话有效），后续路由跳转不需要携带该参数。
- **FR-013**: Express.js 在生产环境提供前端静态资产时，必须使用自定义 handler（不可直接使用 `express.static`），以在向用户返回内容前将 `runtime` 查询参数从 URL 中移除（如通过重定向剥离），确保生产 URL 保持简洁。
- **FR-014**: Express.js 必须对所有非 API 路径及非静态资产文件路径的请求返回前端 `index.html`，以支持客户端路由框架（如 react-router）的浏览器端路由正常工作。
- **FR-015**: 多语言翻译文案必须以 Chrome 扩展标准 i18n 格式存储（`_locales/[语言代码]/messages.json`，每条消息包含 `message` 字段）；前端在 Chrome 扩展环境下通过 `chrome.i18n` 原生 API 访问消息，在网站/PWA/Webview 环境下通过前端适配层读取同一套文件，两种环境共用同一份翻译数据源。

### Key Entities

- **运行环境上下文（RuntimeContext）**: 描述前端当前宿主（`web` / `pwa` / `extension` / `webview`），决定可用功能集合。
- **图片处理任务**: 输入文件、目标格式、转换参数；在有后端时由 API 处理，无后端时仅执行前端可处理的操作。
- **平台能力配置（PlatformCapabilities）**: 根据 RuntimeContext 导出的功能开关映射，供 UI 组件消费。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 前端静态资产可在不启动任何服务器的情况下，通过 Webview 或浏览器直接加载并完整渲染，0 个控制台网络错误。
- **SC-002**: Chrome 扩展包可成功加载到 Chrome，服务端功能入口在扩展界面中不可见（可测试项：DOM 中不存在相关元素）。
- **SC-003**: 网站/PWA 场景下，全部现有格式转换功能（至少 JPG/PNG/WebP/GIF 4 种互转）可正常使用。
- **SC-004**: 网站通过 PWA 安装检查（Lighthouse PWA 审计通过率 ≥ 90 分）。
- **SC-005**: Express.js 服务部署后，通过 Cloudflare Worker 域名访问的静态资产加载时间与现有 Next.js 版本相当（首屏加载不超过现有基准的 150%）。
- **SC-006**: 三种构建产物（网站、Chrome 扩展、独立静态资产）均可从同一套前端源码通过不同构建命令生成，无需维护多份前端代码。
- **SC-007**: 多语言翻译在 Chrome 扩展环境和网站/PWA 环境中均正常显示，且两种环境的翻译数据来自同一套 `_locales/*/messages.json` 文件，无重复维护。
- **SC-008**: 当 Express 收到携带 `?runtime=webview` 的请求时，返回不含该参数的 URL（重定向或等效机制），且前端仍能正确识别 Webview 运行环境。

---

## Assumptions

- Sharp 相关的图片处理功能（含格式转换）在 Chrome 扩展和 Webview 环境下完全不提供，未来如需在这些环境中提供有限处理能力（如通过 Canvas API），属于新需求，不在本次重构范围内。
- Cloudflare Worker 仍作为轻量入口代理，Express.js 服务运行在 Cloudflare Container（Docker/Node.js 环境）中，架构与现有方案一致。
- API 接口不做权限校验（项目定位为公开小工具），保持现有策略。
- 现有 `src/locales/*.json` 翻译文案需迁移至 Chrome 扩展 `_locales/[lang]/messages.json` 格式，语言代码及消息键名规范需适配 Chrome 扩展 i18n 约定（Chrome 扩展支持的语言代码集合需在规划阶段核对）。
- PWA 必须具备 Web App Manifest 和 Service Worker 以支持安装，具体实现方案在规划阶段确定。
- 桌面原生应用集成属于未来工作，本次仅确保前端构建产物具备该能力；原生应用的具体实现不在本次范围内。
- `?runtime=` 参数支持的值集合（如 `webview`、未来可能的其他值）在规划阶段确定；前端初始化逻辑对未知值按 `web` 模式降级处理。
