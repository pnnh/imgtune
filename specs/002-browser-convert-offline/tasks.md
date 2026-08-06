# Tasks: 浏览器端图片转换与离线构建模式

**输入**: `specs/002-browser-convert-offline/` 下的设计文档

**前提条件**: plan.md ✓ spec.md ✓ research.md ✓ data-model.md ✓ contracts/convert-module.md ✓

**说明**: 本功能无需测试任务（规格未要求自动化测试）。验证使用 quickstart.md 中的手动场景。

---

## 格式说明：`[ID] [P?] [Story?] 描述 文件路径`

- **[P]**: 可并行（不同文件，无未完成依赖）
- **[US1/US2/US3]**: 所属用户故事

---

## Phase 1: Setup（共享基础设施）

**目的**: 新增 TypeScript 类型声明和 i18n 键值，所有用户故事均依赖

- [X] T001 [P] 创建 `src/client/vite-env.d.ts`，在 `ImportMetaEnv` 接口中声明 `readonly OFFLINE: boolean`
- [X] T002 [P] 在 `src/client/i18n/types.ts` 的 `MessageKey` 联合类型中追加 `"gifFirstFrameWarning" | "webpNotSupported"`
- [X] T003 [P] 在全部 8 个 `_locales/*/messages.json` 中添加 `gifFirstFrameWarning`（含中英日德等所有语言译文）和 `webpNotSupported` 消息键

---

## Phase 2: Foundational（阻塞性前置任务）

**目的**: 所有用户故事共用的核心类型与运行时能力层

**⚠️ 关键**: 所有用户故事实现均须等待本阶段完成

- [X] T004 重构 `src/client/runtime/context.tsx`：在 `PlatformCapabilities` 接口中新增 `hasBackend: boolean`；将 `computeCapabilities()` 参数改为接受 `runtime: RuntimeContext`，`canConvertImages` 对所有 `RuntimeType`（含 `extension`/`webview`）返回 `true`，`hasBackend` 从 `runtime.hasBackend` 透传；更新 `RuntimeProvider` 调用方式
- [X] T005 [P] 创建 `src/client/convert/capabilities.ts`：定义 `ImageFormat`、`ConversionStrategy`、`FormatCapability`、`CapabilityMatrix` 类型；实现 `computeCapabilityMatrix(hasBackend: boolean): CapabilityMatrix`（含构建时 `import.meta.env.OFFLINE` 分支）；实现 `checkWebPOutputSupport(): Promise<boolean>`，按 contracts/convert-module.md 契约

**检查点**: Foundation 就绪——US1/US2/US3 实现可开始

---

## Phase 3: 用户故事 1 — 纯静态环境基础格式转换（优先级：P1）🎯 MVP

**目标**: 纯静态部署（无后端）下 JPEG/PNG/WebP 互转，不发起任何网络请求；Chrome 扩展和 Webview 不再显示占位 UI

**独立测试**: `pnpm build:web` → `http-server dist --port 8080` → 上传 JPEG 选 PNG 转换 → DevTools Network 无 `/api/convert` 请求 → 下载有效 PNG 文件

- [X] T006 [P] [US1] 创建 `src/client/convert/browserConvert.ts`：定义 `ConversionOptions` 和 `ConversionResult` 接口；实现 `browserConvert(options: ConversionOptions): Promise<ConversionResult>`（Canvas API：`Image` + `drawImage` + `toBlob`，PNG→JPEG 时填白色背景）
- [X] T007 [P] [US1] 创建 `src/client/convert/router.ts`：实现 `routeConversion(options: ConversionOptions, matrix: CapabilityMatrix): Promise<ConversionResult>`，处理 `browser` 策略（调用 `browserConvert`）和 `unavailable` 策略（抛出错误）；服务端路径暂以 `throw new Error('server path not yet implemented')` 占位（T012 填充）
- [X] T008 [US1] 重构 `src/client/components/ImageConverter.tsx` 中的 `handleConvert()`：删除旧的 `fetch('/api/convert', ...)` 调用，改为调用 `routeConversion(options, computeCapabilityMatrix(capabilities.hasBackend))`；更新 `formData` 组装逻辑为 `ConversionOptions` 对象；保持其余状态逻辑不变
- [X] T009 [US1] 更新 `src/client/components/ImageConverter.tsx` 其余 UI：删除 `if (!capabilities.canConvertImages)` 占位符分支（该分支现为死代码）；在格式选择器中根据 `CapabilityMatrix` 过滤 `unavailable` 格式（如 GIF 输出在无后端/OFFLINE 时禁用）；当 `file.type === 'image/gif'` 且目标格式非 GIF 时渲染首帧警告横幅（使用 `getMessage('gifFirstFrameWarning')`）；调用 `checkWebPOutputSupport()` 并在 WebP 不支持时禁用 WebP 选项（tooltip 使用 `getMessage('webpNotSupported')`）
- [X] T010 [US1] 构建验证 US1：执行 `pnpm build:web`，启动 `http-server dist --port 8080`，按 quickstart.md 场景 1 手动验证 JPEG/PNG/WebP 转换正常且无 API 请求；同时验证 `pnpm build:extension` 产物中扩展弹窗显示完整转换 UI

**检查点**: US1 完成——纯静态 JPEG/PNG/WebP 转换正常，Extension/Webview 不再显示占位符

---

## Phase 4: 用户故事 2 — 有后端时的高级转换能力（优先级：P2）

**目标**: 有后端时 GIF 输出经由 `/api/convert` → Sharp 处理；其他格式仍优先浏览器端（节省服务器资源）

**独立测试**: `pnpm dev` → 上传任意图片 → 选 GIF 输出 → DevTools Network 出现 `/api/convert` 请求，响应头含 `X-Processor-Used: sharp`；PNG 输出则无该请求

- [X] T011 [US2] 创建 `src/client/convert/serverConvert.ts`：将 `handleConvert()` 中原有 `fetch('/api/convert', ...)` 逻辑提取为 `serverConvert(options: ConversionOptions): Promise<ConversionResult>`；整个模块包裹于 `if (!import.meta.env.OFFLINE)` 编译期守卫以确保 tree-shaking
- [X] T012 [US2] 更新 `src/client/convert/router.ts`：替换 T007 中的服务端占位错误，改为当 `strategy === 'server'` 时调用 `serverConvert(options)`；确保 `serverConvert` 的导入位于条件块内（`import.meta.env.OFFLINE` 为 false 时才导入）

**检查点**: US2 完成——GIF 输出走服务端，其余格式浏览器端处理

---

## Phase 5: 用户故事 3 — 开发者离线构建模式（优先级：P3）

**目标**: `pnpm build:web:offline` 产物中不含 `/api/convert`，GIF 输出选项隐藏，所有浏览器端格式转换正常

**独立测试**: `pnpm build:web:offline` → `grep -r '/api/convert' dist/` 零结果 → 启动 `http-server dist --port 8080` → JPEG→PNG 正常 → 无 GIF 输出选项

- [X] T013 [US3] 更新 `vite.config.ts`：在 `defineConfig` 中添加 `define: { 'import.meta.env.OFFLINE': JSON.stringify(process.env.VITE_OFFLINE === 'true') }` 字段
- [X] T014 [US3] 更新 `package.json`：新增 `"build:web:offline": "VITE_BUILD_TARGET=web VITE_OFFLINE=true vite build"`、`"build:extension:offline": "VITE_BUILD_TARGET=extension VITE_OFFLINE=true vite build"`、`"build:webview:offline": "VITE_BUILD_TARGET=webview VITE_OFFLINE=true vite build"` 三条脚本
- [X] T015 [US3] OFFLINE 构建验证：执行 `pnpm build:web:offline`，验证 `grep -r '/api/convert' dist/` 零结果（SC-002）；启动 `http-server dist --port 8080` 验证 UI 无 GIF 输出选项（SC-005）；按 quickstart.md 场景 4 完成全量验证

**检查点**: US3 完成——OFFLINE 构建产物不含服务端代码，所有成功标准可验证

---

## Phase 6: 收尾与交叉关注

**目的**: 全量编译验证、回归检查和 i18n 完整性确认

- [X] T016 [P] 执行 `pnpm build:server && pnpm build:web && pnpm build:extension && pnpm build:webview` 全量构建，确认零 TypeScript 编译错误
- [X] T017 [P] 验证 `src/client/i18n/adapter.ts` 中的英文 fallback 消息包含 T002/T003 新增的两个键值（gifFirstFrameWarning、webpNotSupported）
- [X] T018 按 quickstart.md 全量执行 6 个验证场景（含场景 2 回归测试：有后端时服务端功能无变化）

---

## 依赖关系与执行顺序

### 阶段依赖

- **Setup（Phase 1）**: 无依赖，立即开始
- **Foundational（Phase 2）**: 依赖 Phase 1 完成，阻塞所有用户故事
- **US1（Phase 3）**: 依赖 Phase 2 完成
- **US2（Phase 4）**: 依赖 Phase 3 完成（需复用 T007 的 router.ts）
- **US3（Phase 5）**: 依赖 Phase 2 完成（T013、T014 可与 US1/US2 并行）
- **Polish（Phase 6）**: 依赖全部用户故事完成

### 用户故事间依赖

- **US1（P1）**: 依赖 Foundational，无其他故事依赖——可单独交付
- **US2（P2）**: 依赖 US1 的 router.ts（T007），扩展其服务端路径
- **US3（P3）**: 依赖 Foundational（T004/T005），与 US1/US2 独立，可并行

### 并行示例：US1

```
Phase 2 完成后可并行启动：
  T006 browserConvert.ts    ←─────┐
  T007 router.ts            ←─────┤  可同时进行（不同文件）
                                   │
  完成后串行：                      │
  T008 → T009 → T010        ───────┘  (均修改 ImageConverter.tsx，需串行)
```

### 并行示例：US3（与 US1/US2 并行）

```
Phase 2 完成后：
  T013 vite.config.ts  ←── 可与 US1 T006-T010 同时进行
  T014 package.json    ←── 可与 US1 T006-T010 同时进行
  T015 验证            ──── 等待 T013+T014 完成
```

---

## 实施策略

**MVP 范围（仅 US1）**: 完成 T001–T010 即可交付核心价值：

- 纯静态部署下图片转换可用
- Extension/Webview 中转换 UI 恢复

**增量交付**:

1. T001–T010（US1）→ 解决当前 bug，Extension/Webview 转换可用
2. T011–T012（US2）→ 有后端时 GIF 输出恢复
3. T013–T015（US3）→ OFFLINE 构建模式
4. T016–T018（Polish）→ 全量验证收尾

---

## Phase 7: Convergence

> 本阶段任务来源于 speckit.converge 对更新后规格（澄清 2026-08-06）与现有实现之间差距的评估。

- [X] T019 更新 `src/client/runtime/detect.ts`：将 extension（第 38 行）和 webview（第 52 行）的 `hasBackend: false` 改为 `true` — 所有运行时类型均认为后端可访问 per FR-004（contradicts）
- [X] T020 在 `src/client/i18n/types.ts` 的 `MessageKey` 联合类型中追加 `"backendError" | "connectionTimeout"`；并在全部 8 个 `_locales/*/messages.json` 中添加对应译文（backendError 格式如"后端转换失败 ({status})"，connectionTimeout 如"连接超时，请稍后重试"）per FR-005/FR-006（missing）
- [X] T021 重构 `src/client/convert/serverConvert.ts`：① 将 `response.json()` 包裹在 try-catch 中处理非 JSON 响应（SC-005）；② 错误消息中包含 HTTP 状态码（使用 `getMessage("backendError")` 并插值状态码）（FR-005）；③ 用 `AbortController` 添加 30 秒请求超时，超时时 throw 含 `getMessage("connectionTimeout")` 的独立错误（FR-006）per FR-005, FR-006, SC-005（partial）
- [X] T022 移除 `src/client/convert/capabilities.ts` 中的 OFFLINE 条件：将 `if (import.meta.env.OFFLINE || !hasBackend)` 替换为 `if (!hasBackend)` per 澄清 US3 scope（contradicts）
- [X] T023 移除 `src/client/convert/router.ts` 中的 OFFLINE 条件：将 `if (import.meta.env.OFFLINE || capability.strategy === "browser")` 替换为 `if (capability.strategy === "browser")`；同步删除相关注释 per 澄清 US3 scope（contradicts）
- [X] T024 删除或清空 `src/client/vite-env.d.ts` 中的 `OFFLINE` 类型声明（移除 `ImportMetaEnv` 中的 `readonly OFFLINE: boolean` 及冗余 `ImportMeta` 块）per 澄清 US3 scope（contradicts）
- [X] T025 移除 `vite.config.ts` 中的 `define` 字段（`import.meta.env.OFFLINE` 注入）per 澄清 US3 scope（contradicts）
- [X] T026 从 `package.json` 中删除 `build:web:offline`、`build:extension:offline`、`build:webview:offline` 三条脚本 per 澄清 US3 scope（contradicts）

---

## Phase 8: Convergence

> 本阶段任务来源于 speckit.converge 第二轮评估（2026-08-06）。

- [X] T027 在 `src/client/components/ImageConverter.tsx` 的 `handleFileSelect()` 中添加文件大小检查：当 `selectedFile.size > 50 * 1024 * 1024`（50MB）时展示性能警告横幅（需新增对应 i18n 键 `largeSizeWarning` 及 8 个语言译文），仍允许用户继续转换 per 规格边界情况 + quickstart 场景 6（partial）
