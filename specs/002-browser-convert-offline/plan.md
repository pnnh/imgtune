# 实施计划：浏览器端图片转换与离线构建模式

**分支**: `main` | **日期**: 2026-08-05 | **规格**: [spec.md](./spec.md)

**输入**: 功能规格说明 `specs/002-browser-convert-offline/spec.md`

---

## 摘要

将现有图片转换功能重构为双路由架构：浏览器端（Canvas API，无网络请求，所有运行时可用）和服务端（POST /api/convert，仅有后端且目标为 GIF 时使用）。引入构建时 `import.meta.env.OFFLINE` 标志，通过 Vite `define` + Rollup tree-shaking 生成完全离线版本。修复 Chrome 扩展和 Webview 中转换 UI 不可用的缺陷。

---

## 技术上下文

**语言/版本**: TypeScript 5.x / React 19 / Node.js 22

**主要依赖**: Vite 6、`@vitejs/plugin-react`、`@tailwindcss/vite`、`vite-plugin-pwa`、Express 5、Sharp、Jimp（后两者仅服务端）

**存储**: N/A（无状态图片转换，无持久化）

**测试**: 手动 + 构建验证（详见 [quickstart.md](./quickstart.md)）

**目标平台**: 浏览器（Chrome 50+、Firefox 53+、Safari 11+）+ Node.js（服务端）

**项目类型**: 多目标 Web 应用（web / extension / webview / PWA）

**性能目标**: 浏览器端转换 < 5MB 图片 < 5 秒

**约束**: OFFLINE 构建产物不含 `/api/convert`；Safari < 14 无 WebP 输出

**规模**: 单用户会话，无状态

---

## Constitution Check

**规则**: 所有文档输出必须使用简体中文（NON-NEGOTIABLE）。

- [x] plan.md 使用简体中文 ✓
- [x] 技术标识符保持英文 ✓
- [x] 代码示例中的注释使用中文 ✓
- [x] 无违反 constitution 的情况 → 通过所有门控

---

## 项目结构

### 本功能文档

```text
specs/002-browser-convert-offline/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出（已完成）
├── data-model.md        # Phase 1 输出（已完成）
├── quickstart.md        # Phase 1 输出（已完成）
├── contracts/
│   └── convert-module.md  # Phase 1 输出（已完成）
└── tasks.md             # Phase 2 输出（由 /speckit.tasks 生成）
```

### 源代码变更（相对项目根目录）

```text
# 新增文件
src/client/convert/
├── capabilities.ts     # 能力矩阵计算（CapabilityMatrix）
├── browserConvert.ts   # Canvas API 转换实现
├── serverConvert.ts    # 服务端 /api/convert 调用（OFFLINE 时 tree-shaken）
└── router.ts           # 转换路由器（strategy 选择）

src/client/vite-env.d.ts  # 扩展 ImportMetaEnv，声明 OFFLINE 类型

# 修改文件
src/client/components/ImageConverter.tsx  # 使用 routeConversion()，修复 GIF 提示
src/client/runtime/context.tsx            # 重构 PlatformCapabilities，canConvertImages 始终 true，新增 hasBackend
vite.config.ts                            # 添加 OFFLINE define 注入
package.json                              # 添加 build:*:offline 脚本

# _locales 可能需要新增翻译键
_locales/*/messages.json                  # 新增 "gifFirstFrameWarning"、"webpNotSupported" 等 i18n 键
```

---

## Complexity Tracking

> 无 Constitution 违规，此部分留空。

---

## Phase 0 研究摘要

详见 [research.md](./research.md)。关键结论：

| 研究项 | 结论 |
| -------- | ------ |
| 浏览器端转换库 | 使用原生 Canvas API，零额外依赖 |
| GIF 输入解码 | 浏览器原生，Canvas 绘制第一帧 |
| GIF 输出 | 浏览器不支持，OFFLINE 模式下隐藏选项 |
| OFFLINE 构建 | Vite `define` + Rollup tree-shaking，`import.meta.env.OFFLINE` 编译期替换 |
| WebP 支持检测 | Canvas.toBlob 测试，Safari < 14 禁用选项 |
| PlatformCapabilities | `canConvertImages` 全部改为 `true`，新增 `hasBackend` |

---

## Phase 1 设计产物

| 产物 | 状态 | 路径 |
| ------ | ------ | ------ |
| 数据模型 | ✅ | [data-model.md](./data-model.md) |
| 转换模块契约 | ✅ | [contracts/convert-module.md](./contracts/convert-module.md) |
| 快速验证指南 | ✅ | [quickstart.md](./quickstart.md) |

---

## Phase 2 实施计划（高层次）

> 详细任务列表由 `/speckit.tasks` 生成。

### 优先顺序（P1 → P3）

**P1 — 核心浏览器端转换（US1）**:

1. 新增 `src/client/convert/capabilities.ts`：能力矩阵计算
2. 新增 `src/client/convert/browserConvert.ts`：Canvas API 转换
3. 新增 `src/client/convert/router.ts`：转换路由器
4. 重构 `src/client/runtime/context.tsx`：`canConvertImages = true`，新增 `hasBackend`
5. 重构 `ImageConverter.tsx`：使用 `routeConversion()`，添加 GIF 首帧提示
6. 新增 i18n 键：`gifFirstFrameWarning`、`webpNotSupported`

**P2 — 服务端保留（US2）**:
7. 新增 `src/client/convert/serverConvert.ts`：封装现有 fetch /api/convert 逻辑
8. 更新 `router.ts` 中 GIF 输出走服务端路径
9. 移除 `ImageConverter.tsx` 中旧的 `if (!capabilities.canConvertImages)` 占位符

**P3 — OFFLINE 构建模式（US3）**:
10. 更新 `vite.config.ts`：添加 `define.import.meta.env.OFFLINE`
11. 新增 `src/client/vite-env.d.ts`（或更新）：声明 `OFFLINE` 类型
12. 更新 `package.json`：新增 `build:web:offline`、`build:extension:offline`、`build:webview:offline`
13. 验证 OFFLINE 构建产物（`grep -r /api/convert dist/` 零结果）

### 关键依赖关系

```
capabilities.ts
    ↑
browserConvert.ts  ←──── router.ts ────→ serverConvert.ts
                              ↑
                    ImageConverter.tsx（使用 routeConversion）
                              ↑
                    context.tsx（提供 hasBackend）
```
