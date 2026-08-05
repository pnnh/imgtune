# 快速验证指南：浏览器端图片转换与离线构建模式

**阶段**: Phase 1 设计  
**日期**: 2026-08-05  
**功能**: [spec.md](./spec.md)

---

## 前提条件

```sh
# 确保依赖已安装
pnpm install

# 安装 http-server（如果尚未安装）
pnpm add -g http-server
```

---

## 场景 1：纯静态环境基础格式转换（US1 P1）

**验证 SC-001**：无后端时 JPEG/PNG/WebP 转换成功，不发起 API 请求。

```sh
# 构建 web 目标
pnpm build:web

# 启动纯静态服务（无后端）
http-server dist --port 8080 --cors
```

打开浏览器 `http://127.0.0.1:8080`，打开 DevTools → Network 标签页：

| 操作 | 预期结果 |
| ------ | --------- |
| 上传一张 JPEG，选择 PNG 输出，点击转换 | 触发下载，Network 中无 `/api/convert` 请求 |
| 上传一张 PNG，选择 WebP 输出，点击转换 | 触发下载，文件类型为 `image/webp` |
| 上传一张 GIF，选择 JPEG 输出 | 显示"仅转换第一帧"提示横幅，转换成功 |
| 格式选择器中查看 GIF 输出选项 | GIF 选项被禁用或不显示 |

---

## 场景 2：有后端的完整功能验证（US2 P2）

**验证 SC-004**：有后端时服务端功能无回归。

```sh
# 启动开发服务器（Vite + Express）
pnpm dev
```

打开浏览器 `http://localhost:5173`，打开 DevTools：

| 操作 | 预期结果 |
| ------ | --------- |
| 上传 GIF，选择 GIF 输出（同格式转换） | Network 中有 `/api/convert` 请求，响应头含 `X-Processor-Used: sharp` |
| 上传 JPEG，选择 PNG 输出 | Network 中**无** `/api/convert` 请求（浏览器端处理） |
| 上传 JPEG，选择 WebP 输出 | Network 中**无** `/api/convert` 请求（浏览器端处理） |

---

## 场景 3：Webview / Extension 运行时下的转换（US1 扩展验证）

```sh
# 构建扩展目标
pnpm build:extension

# 在 Chrome 中加载 dist-ext/ 目录（chrome://extensions → 加载已解压的扩展）
```

| 操作 | 预期结果 |
| ------ | --------- |
| 打开扩展弹窗，上传 JPEG，选择 PNG | 转换成功，无 API 请求 |
| 之前的"不支持后端"占位提示 | 不再显示，替换为完整转换 UI |

---

## 场景 4：OFFLINE 构建验证（US3 P3）

**验证 SC-002 + SC-005**：OFFLINE 构建产物中不含 `/api/convert`，UI 中无 GIF 输出选项。

```sh
# 构建 OFFLINE 版本
pnpm build:web:offline

# 验证产物中不含 /api/convert 字符串
grep -r '/api/convert' dist/ && echo "FAIL: 含 API 调用" || echo "PASS: 无 API 调用"

# 启动纯静态服务
http-server dist --port 8080
```

打开浏览器 `http://127.0.0.1:8080`：

| 操作 | 预期结果 |
| ------ | --------- |
| `grep -r '/api/convert' dist/` 命令 | 无匹配结果（返回非 0 exit code） |
| 格式选择器 | 无 GIF 输出选项 |
| JPEG → PNG 转换 | 正常工作 |

---

## 场景 5：WebP 浏览器支持降级（边界情况）

在 Safari < 14 环境中（或使用 BrowserStack）：

| 操作 | 预期结果 |
| ------ | --------- |
| 查看格式选择器 | WebP 输出选项显示为禁用状态（灰色），有 tooltip 说明不支持 |
| 尝试其他格式（JPEG/PNG） | 正常可用 |

---

## 场景 6：大文件性能边界

上传大于 10MB 的图片：

| 操作 | 预期结果 |
| ------ | --------- |
| 选择 > 50MB 图片（浏览器端转换） | 显示性能警告，提示文件较大，仍允许继续 |
| 完成转换 | 在合理时间内（< 30s）完成，不崩溃 |

---

## 验证检查清单

- [ ] 场景 1：纯静态环境基础转换，无 API 请求
- [ ] 场景 2：有后端时服务端功能无回归
- [ ] 场景 3：Extension/Webview 中转换功能可用（不再显示占位）
- [ ] 场景 4：`grep /api/convert dist/` 零结果（OFFLINE 构建）
- [ ] 场景 4：OFFLINE 构建中无 GIF 输出选项
- [ ] 场景 5：不支持 WebP 的浏览器中选项被禁用（非报错）
- [ ] 场景 6：大文件处理有警告提示
