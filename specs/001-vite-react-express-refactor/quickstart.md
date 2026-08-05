# 快速验证指南：多平台架构重构

**关联 Spec**: [spec.md](./spec.md) | **关联 Plan**: [plan.md](./plan.md)
**生成日期**: 2026-08-05

本文档提供各用户故事的端到端验证步骤，证明功能按预期工作。

---

## 前置准备

```bash
# 安装依赖
pnpm install

# 构建后端（TypeScript → JavaScript）
pnpm build:server

# 构建前端（网站版本）
pnpm build:web
```

详细 API 规范见 [contracts/api.md](./contracts/api.md)；运行时参数协议见 [contracts/runtime.md](./contracts/runtime.md)。

---

## User Story 1 验证：网站/PWA 完整图片转换功能（P1）

**对应 SC-003、SC-004**

### 步骤 1：启动开发服务器

```bash
# 启动 Express 后端（前后端一体）
pnpm dev
# 访问 http://localhost:3000
```

### 步骤 2：基本转换功能验证

1. 打开浏览器，访问 `http://localhost:3000`
2. 拖入或点击上传一张 PNG 图片
3. 选择目标格式：WebP
4. 点击「开始转换」
5. **预期结果**：进度状态变为转换中 → 显示结果预览 → 可点击下载按钮下载 `.webp` 文件

### 步骤 3：验证所有格式互转

| 源格式 | 目标格式 | 预期 |
| -------- | --------- | ------ |
| PNG | WebP | ✅ 可下载 |
| JPEG | PNG | ✅ 可下载 |
| WebP | GIF | ✅ 可下载 |
| GIF | JPEG | ✅ 可下载 |

### 步骤 4：PWA 安装验证

1. 生产构建后部署到 HTTPS 域名（或使用 `pnpm preview`）
2. 在 Chrome 地址栏右侧查看安装图标
3. 点击安装 → 确认 → 以 standalone 模式打开
4. 重复步骤 2–3，**预期结果**：转换功能完全正常

### Lighthouse PWA 审计

```bash
# 本地生产预览
pnpm preview
# 在 Chrome DevTools → Lighthouse → 选择 Progressive Web App → 生成报告
# 目标：PWA 评分 ≥ 90 分（SC-004）
```

---

## User Story 2 验证：Chrome 扩展独立运行（P2）

**对应 SC-001、SC-002、SC-006**

### 步骤 1：构建 Chrome 扩展

```bash
pnpm build:extension
# 产物目录：dist-ext/
```

### 步骤 2：加载扩展

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择 `dist-ext/` 目录
4. 确认扩展出现在列表中

### 步骤 3：验证服务端功能入口隐藏

1. 点击扩展图标打开界面
2. 检查转换格式选项区域
3. **预期结果（SC-002）**：服务端转换功能入口（如格式选择、转换按钮）不可见
4. **验证命令**（可选，DevTools 中执行）：

   ```javascript
   // 应返回 null 或 0（相关元素不存在）
   document.querySelector('[data-requires-backend]')
   ```

### 步骤 4：验证无网络环境下正常运行

1. 在 Chrome 扩展界面打开（Chrome DevTools → Network → Offline）
2. **预期结果**：页面仍可渲染，不出现网络请求错误（SC-001）

---

## User Story 3 验证：Webview 嵌入（P3）

**对应 SC-001、SC-008**

### 步骤 1：模拟原生应用 Webview 打开

```bash
# 构建网站版本
pnpm build:web && pnpm preview
```

在浏览器中访问以下 URL，模拟原生应用的 Webview 打开行为：

```
http://localhost:4173/?runtime=webview
```

### 步骤 2：验证 runtime 参数剥离（SC-008）

1. 打开 `http://localhost:4173/?runtime=webview`
2. **预期结果**：发生 302 重定向，浏览器地址栏显示 `http://localhost:4173/`（无 `?runtime=webview`）
3. 检查 Cookie（DevTools → Application → Cookies）：`imgtune-runtime=webview` 短暂存在后被前端清除

### 步骤 3：验证 Webview 环境检测

1. 重定向到根路径后，检查前端状态
2. **预期结果**：服务端功能入口与 Chrome 扩展中一致，处于隐藏状态
3. **验证命令**（DevTools Console）：

   ```javascript
   // 应返回 'webview'
   sessionStorage.getItem('imgtune-runtime')
   ```

---

## User Story 4 验证：Cloudflare 部署（P4）

**对应 SC-005**

### 步骤 1：本地模拟 Cloudflare 部署

```bash
# 构建完整产物（前端 + 后端）
pnpm build

# 启动 Wrangler 开发环境
pnpm cf:preview
```

### 步骤 2：通过 Worker 访问

1. 访问 Wrangler 输出的本地 URL（通常 `http://localhost:8787`）
2. **预期结果**：网站正常加载，前端静态资产无 404

### 步骤 3：验证 API 通过 Worker 可达

```bash
curl -X POST http://localhost:8787/api/convert \
  -F "file=@/path/to/test.png" \
  -F "targetFormat=webp" \
  --output test-output.webp

# 预期：test-output.webp 文件存在且是有效 WebP 图片
file test-output.webp  # 应输出：test-output.webp: RIFF ... WebP ...
```

### 步骤 4：验证 SPA 路由不产生 404

```bash
# 访问一个前端路由路径（该路径不是实际文件）
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/some-page
# 预期：200（返回 index.html）
```

---

## 多语言验证（适用所有 User Stories）

**对应 SC-007**

### 验证统一翻译数据源

1. 检查 `_locales/` 目录存在且包含 8 个语言目录
2. 在网站环境切换到「简体中文」→ 确认界面文字正确
3. 在 Chrome 扩展中，设置浏览器语言为中文（Chrome 设置 → 语言）→ 重启扩展 → 确认界面显示简体中文
4. **预期（SC-007）**：两种环境的翻译文字来自同一套 `_locales/zh_CN/messages.json` 文件

### 验证 8 种语言

| 语言 | 切换方式 | 验证点 |
| ------ | --------- | -------- |
| English | 语言选择器 | 所有文字为英文 |
| 简体中文 | 语言选择器 | 所有文字为简体中文 |
| 繁體中文 | 语言选择器 | 所有文字为繁体中文 |
| Deutsch | 语言选择器 | 所有文字为德文 |
| Español | 语言选择器 | 所有文字为西班牙文 |
| Français | 语言选择器 | 所有文字为法文 |
| 日本語 | 语言选择器 | 所有文字为日文 |
| Português | 语言选择器 | 所有文字为葡萄牙文 |
