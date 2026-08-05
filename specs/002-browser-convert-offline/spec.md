# 功能规格说明：浏览器端图片转换与离线构建模式

**功能分支**: `002-browser-convert-offline`

**创建日期**: 2026-08-05

**状态**: 草稿

## 背景

当前实现中，所有图片转换操作均通过调用后端 `/api/convert` 接口完成。当用户以纯静态方式部署前端（无 Express 后端）时，点击转换按钮会抛出 "Failed to execute 'json' on 'Response': Unexpected end of JSON input" 错误。

本功能将转换能力重构为两个层次：**浏览器端转换**（优先，无需后端）和**服务端增强转换**（可选，依赖后端 Node.js）。同时引入 `import.meta.env.OFFLINE` 构建标志，支持构建完全无服务端依赖的离线版本。

---

## 用户场景与测试 *(必填)*

### 用户故事 1 - 纯静态环境下的基础格式转换（优先级：P1）

用户在没有后端服务的纯静态部署环境（如 GitHub Pages、Chrome 扩展、Webview、本地 http-server）下，能够在浏览器中完成 JPEG、PNG、WebP 之间的基本格式互转，无需任何网络请求。

**优先原因**：这是解决当前 bug 的核心路径，也是保障离线可用性的基础。所有非后端部署场景（Chrome 扩展、Webview、静态网站）都依赖此能力。

**独立测试**：使用 `http-server` 在本地启动 `dist/` 目录（无 Express），上传一张 JPEG 图片，选择转为 PNG，点击转换，验证下载的文件为有效 PNG，且全程无 `/api/convert` 网络请求。

**验收场景**:

1. **Given** 用户在纯静态环境访问页面且已选中一张 JPEG 图片，**When** 选择输出格式为 PNG 并点击转换，**Then** 浏览器直接完成转换并触发下载，不发起任何后端 API 请求。
2. **Given** 用户选择 WebP 输出，**When** 点击转换，**Then** 使用浏览器 Canvas API 完成 WebP 编码，文件可正常打开。
3. **Given** 后端不可用（网络错误），**When** 用户尝试需要后端的高级功能，**Then** 系统自动降级到浏览器端实现（如有），或显示明确提示。
4. **Given** 用户上传 GIF 文件并选择转为 JPEG，**When** 点击转换，**Then** 提取第一帧执行转换（无动画保留），并向用户显示"仅转换第一帧"的提示。

---

### 用户故事 2 - 有后端时的高级转换能力（优先级：P2）

用户在具备后端服务的完整部署环境（Web/PWA）下，访问到需要 Sharp 等服务端库才能提供的高质量转换功能，浏览器端实现效果明显不佳的格式（如高质量渐进式 JPEG、动态 GIF 处理）优先走后端。

**优先原因**：确保付费或全功能场景下的用户体验质量不下降。

**独立测试**：在 `pnpm dev` 环境（Vite dev server + Express）下上传图片，验证转换经过后端 Sharp 处理，检查响应头中包含 `X-Processor-Used: sharp`。

**验收场景**:

1. **Given** 后端可用（`hasBackend === true`），**When** 用户执行需要 Sharp 的转换操作，**Then** 请求发送至 `/api/convert` 并使用 Sharp 处理。
2. **Given** 有后端环境，**When** 浏览器端实现已能高质量完成的格式（如 PNG→WebP），**Then** 仍优先使用浏览器端实现以节省服务器资源。
3. **Given** 后端可用时功能集应为浏览器端功能的超集，**When** 用户操作，**Then** 对用户透明（不需要用户感知当前走哪条路径）。

---

### 用户故事 3 - 开发者离线构建模式（优先级：P3）

开发者可以通过构建时注入 `OFFLINE=true` 环境变量，生成完全不含后端 API 调用代码的离线构建产物。该产物的 UI 中不显示任何需要服务端才能使用的功能入口。

**优先原因**：支持更灵活的发布策略（如完全离线的 Chrome 扩展、静态 CDN 部署），并节省服务器资源。

**独立测试**：执行 `pnpm build:web:offline`，检查 `dist/` 中不含任何 `/api/convert` 字符串，且浏览器访问时 UI 中不出现任何需要后端的功能。

**验收场景**:

1. **Given** 以 `OFFLINE=true` 构建，**When** 检查构建产物，**Then** 产物中不包含 `/api/convert` 调用代码（tree-shaking 已移除）。
2. **Given** OFFLINE 构建产物运行在浏览器中，**When** 用户打开页面，**Then** 界面中不显示任何标记为"需要服务端"的功能入口或按钮。
3. **Given** OFFLINE 模式，**When** 执行支持的浏览器端格式转换，**Then** 转换正常进行，与在线版体验一致。

---

### 边界情况

- 浏览器不支持 WebP 输出（Safari < 14）时，WebP 输出选项如何处理？→ 显示不可用提示或禁用该选项。
- 图片文件大于 50MB 时，浏览器端 Canvas 处理可能导致内存不足 → 需提示文件大小限制，建议使用服务端处理。
- 输入格式为 AVIF 时，浏览器解码支持不稳定 → AVIF 输入格式标记为"实验性"，优先走服务端。
- 当 `import.meta.env.OFFLINE` 为 `true` 但浏览器端不支持某格式时 → 禁用该格式选项而非抛出错误。

---

## 需求 *(必填)*

### 功能需求

- **FR-001**: 系统必须使用浏览器 Canvas API 实现 JPEG、PNG、WebP 三种格式间的互转（不依赖后端）。
- **FR-002**: 当 `RuntimeContext.hasBackend === false` 时，系统必须自动使用浏览器端转换方案，不发起任何 API 请求。
- **FR-003**: 当 `RuntimeContext.hasBackend === true` 且浏览器端实现质量不足时，系统可将请求转发至后端 `/api/convert`。
- **FR-004**: 构建时支持 `OFFLINE` 环境变量（通过 `import.meta.env.OFFLINE` 访问），当其为 `true` 时，所有后端依赖的代码路径必须被静态移除（tree-shaking）。
- **FR-005**: 需新增以下构建脚本：`build:web:offline`、`build:extension:offline`、`build:webview:offline`（在现有脚本基础上追加 `VITE_OFFLINE=true`）。
- **FR-006**: UI 在离线模式或无后端运行时，必须隐藏标记为需要服务端的功能（如动态 GIF 处理），不显示不可用的选项。
- **FR-007**: 浏览器端转换需支持质量参数（JPEG quality），行为应与服务端保持一致。
- **FR-008**: GIF 输入文件在浏览器端转换时，系统必须告知用户仅提取第一帧。

### 关键实体

- **ConversionStrategy（转换策略）**: 描述某格式组合的转换方式（`browser` | `server` | `unavailable`），包含支持的输入/输出格式映射。
- **ConversionRequest（转换请求）**: 包含文件、目标格式、质量参数，运行时决定调用哪个策略。
- **CapabilityMatrix（能力矩阵）**: 运行时计算当前环境（浏览器特性 + `hasBackend` + `OFFLINE` 标志）下每种转换组合的可用性。

---

## 成功标准 *(必填)*

### 可量化结果

- **SC-001**: 纯静态部署下，用户对 JPEG/PNG/WebP 常规图片（< 5MB）执行格式转换，全程不发起任何网络请求，转换成功率 100%。
- **SC-002**: OFFLINE 构建产物（`dist/`）中不包含任何字符串 `/api/convert`（可通过 `grep -r '/api/convert' dist/` 验证）。
- **SC-003**: 浏览器端转换对常规图片（< 5MB）的完成时间不超过 5 秒。
- **SC-004**: 有后端环境下，现有服务端转换功能无回归，通过现有测试场景验证。
- **SC-005**: 离线构建产物 UI 中，不出现任何需要后端才能使用的功能入口。

---

## 假设

- 用户浏览器版本支持 Canvas API 的 `toBlob()`（覆盖主流浏览器 Chrome 50+、Firefox 53+、Safari 11+）。
- WebP 输出的目标浏览器版本：Chrome 32+、Firefox 65+、Safari 14+（Safari 14 以下降级提示）。
- 不要求支持服务端渲染（SSR）场景，所有浏览器端转换逻辑仅在客户端执行。
- 浏览器端 Canvas 转换质量对大多数用例已足够；高精度专业场景（色彩管理、ICC Profile）仍依赖服务端。
- 现有 `RuntimeContext` 和 `hasBackend` 判断逻辑保持不变，新增浏览器端转换不影响现有运行时检测机制。
- `import.meta.env.OFFLINE` 标志在 Vite 中通过 `define` 或 `loadEnv` 注入，构建时为静态布尔值，支持 tree-shaking。
