# 运行环境契约：runtime URL 参数协议

**版本**: 1.0
**适用场景**: 桌面原生应用通过 Webview 嵌入前端时，向前端传递运行环境信号

---

## 概述

原生应用在加载 Webview 时，于入口 URL 附加 `?runtime=webview` 参数。Express 后端拦截该参数，通过 Cookie 将运行环境信号传递给前端，然后 302 重定向到不含该参数的干净 URL。

---

## URL 参数规范

### 参数名

`runtime`

### 支持的值

| 值 | 触发环境 | 说明 |
|----|---------|------|
| `webview` | 桌面原生应用嵌入 Webview | 当前唯一支持的值 |

**未知值处理**: 前端对未知 `runtime` 值按 `web` 模式降级，不产生错误。

### 使用示例

```
# 原生应用打开 Webview 时使用的入口 URL
https://imgtune.example.com/?runtime=webview

# 若存在其他查询参数，runtime 应放最后（约定，非强制）
https://imgtune.example.com/some-path?foo=bar&runtime=webview
```

---

## 服务端处理流程（Express）

```
收到含 ?runtime=xxx 的请求
  ↓
读取 runtime 参数值
  ↓
设置 Cookie: imgtune-runtime={value}; SameSite=Lax; Path=/; Max-Age=3600; HttpOnly=false
  ↓
302 重定向到同路径但不含 runtime 参数的 URL
（其余查询参数保留）
```

**Cookie 字段说明**:

| 字段 | 值 | 原因 |
| ------ | --- | ------ |
| `Name` | `imgtune-runtime` | 约定名称，前端读取时使用 |
| `SameSite` | `Lax` | 防止跨站请求携带，同时允许顶级导航 |
| `Path` | `/` | 全站有效 |
| `Max-Age` | `3600`（1 小时） | 会话级临时 Cookie，避免长期残留 |
| `HttpOnly` | `false` | 前端 JavaScript 需要读取此 Cookie |
| `Secure` | 按部署环境 | 生产环境（HTTPS）自动设置 |

---

## 客户端处理流程（React 前端）

```
应用初始化（main.tsx）
  ↓
检测 chrome.runtime.id → 若存在则为 extension 模式（跳过 Cookie 检测）
  ↓
读取 Cookie: imgtune-runtime
  ↓
若 Cookie 存在 → 写入 sessionStorage('imgtune-runtime') → 清除 Cookie
  ↓
根据 sessionStorage 或其他信号确定 RuntimeContext.type
  ↓
React Context Provider 提供 RuntimeContext 给所有组件
```

**sessionStorage 键**: `imgtune-runtime`  
**Cookie 清除时机**: 前端读取 Cookie 后立即清除（`document.cookie = 'imgtune-runtime=; Max-Age=0; Path=/'`），避免 Cookie 在后续导航中重复触发。

---

## 序列图

```
原生应用        Webview         Express           前端 React
  │               │                │                  │
  │ 打开 URL       │                │                  │
  │ /?runtime=    │                │                  │
  │  webview ────►│                │                  │
  │               │─── HTTP GET ──►│                  │
  │               │   /?runtime=   │                  │
  │               │    webview     │                  │
  │               │                │ 读取 runtime 参数 │
  │               │                │ 设置 Cookie       │
  │               │◄── 302 ───────│                  │
  │               │  Set-Cookie:   │                  │
  │               │  imgtune-      │                  │
  │               │  runtime=      │                  │
  │               │  webview       │                  │
  │               │─── HTTP GET ──►│                  │
  │               │       /        │                  │
  │               │◄── index.html ─│                  │
  │               │                │──── React 启动 ──►│
  │               │                │                  │ 读取 Cookie
  │               │                │                  │ 写入 sessionStorage
  │               │                │                  │ 清除 Cookie
  │               │                │                  │ 确定 RuntimeContext
  │               │                │                  │ = 'webview'
```

---

## 原生应用集成要求

使用此协议的原生应用必须满足：

1. 在打开 Webview 的入口 URL 末尾追加 `?runtime=webview`
2. 允许 Webview 跟随 302 重定向
3. 允许 Webview 读写 `imgtune-runtime` Cookie（无特殊要求，标准行为）
4. 不需要在后续 Webview 导航中注入任何特殊参数

**不支持的场景**: 若原生应用的 Webview 禁用了 Cookie，则此协议失效。此时前端将按 `web` 模式运行，显示全部功能（含服务端功能入口），但无法连接后端时会显示错误提示。
