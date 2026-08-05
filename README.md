# ImgTune

一个基于 [Next.js](https://nextjs.org) 构建的多语言图片格式转换工具，部署于 **Cloudflare Containers**。

支持的转换格式：**JPG ↔ PNG ↔ WebP ↔ GIF**  
支持的语言：English, 简体中文, 繁體中文, 日本語, Deutsch, Español, Français, Português

---

## 工作原理

| 层级 | 技术 | 作用 |
|---|---|---|
| 前端 | Next.js 16 (App Router) | UI、i18n 路由、文件上传 |
| API | `src/app/api/convert/route.ts` | 通过 **Sharp** + **Jimp** 进行图片转换 |
| 运行时 | Docker 容器 (Node.js 22) | 运行 Next.js standalone 服务器 |
| 边缘入口 | Cloudflare Worker (`worker.ts`) | 轻量代理，将流量路由到容器 |
| 平台 | Cloudflare Containers | 在边缘管理容器生命周期 |

`sharp` 库需要原生 C++ 绑定，无法在 Cloudflare Worker（V8 isolate）中运行。  
以 **Cloudflare Container** 方式部署可获得完整的 Node.js 运行时，原生模块可正常工作。

---

## 本地开发

```bash
# 安装依赖（首次或添加包后）
pnpm install

# 在 7412 端口启动 Next.js 开发服务器
pnpm dev
```

在浏览器中打开 [http://localhost:7412](http://localhost:7412)。

---

## 部署到 Cloudflare Containers

### 前置条件

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4+（`pnpm add -g wrangler`）
- 已安装并运行 [Docker](https://docs.docker.com/get-docker/)（`wrangler deploy` 会用它构建容器镜像）
- 已启用 **Containers** 的 Cloudflare 账号（开放测试阶段 — 在 Cloudflare 控制台中启用）

### 身份验证

```bash
wrangler login
```

### 首次部署

```bash
pnpm deploy
# 等同于：pnpm build && wrangler deploy
```

`wrangler deploy` 会：

1. 构建 Next.js 应用（`next build` → `.next/standalone`）
2. 从 `./Dockerfile` 构建 Docker 镜像
3. 将容器镜像推送到 Cloudflare 的 registry
4. 部署 Worker 代理（`worker.ts`）
5. 注册 `ImgTuneApp` Durable Object 迁移

### 后续部署

```bash
pnpm deploy
```

## GitHub Actions 自动部署

本仓库包含自动化部署工作流：

- 工作流文件：`.github/workflows/deploy-cloudflare-containers.yml`
- 触发条件：推送到 `main` 以及手动 `workflow_dispatch`
- 流程：安装依赖 -> 构建 Next.js -> 运行 `wrangler deploy`

### 所需的 GitHub Secrets

在 GitHub 仓库中添加以下 secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

推荐的 API token 权限：

- Workers Scripts: Edit
- Workers Routes: Edit
- Workers Tail: Read（可选）
- Cloudflare Containers 部署所需的账号级权限

### CI 部署行为

每次推送到 `main` 时，GitHub Actions 会：

1. 从 lockfile 安装 pnpm 依赖
2. 构建 standalone Next.js 输出
3. 在 runner 中构建 Docker 镜像
4. 通过 Wrangler 部署 Worker + Container

如果部署失败，请检查 GitHub Actions 中的工作流日志，并验证 Cloudflare token 权限范围和 account id。

### 使用 Wrangler 本地预览

> **注意：** 完整的 Container 模拟需要 Docker。以下命令仅启动 Worker 部分。

```bash
pnpm cf:preview   # wrangler dev
```

---

## 项目结构

```
imgtune/
├── Dockerfile              # 多阶段镜像：deps → build → runner
├── .dockerignore
├── worker.ts               # Cloudflare Worker 代理（wrangler 入口点）
├── wrangler.jsonc          # Cloudflare 部署配置（Container + DO binding）
├── next.config.ts          # Next.js 配置 — output: "standalone"
├── package.json
├── public/
└── src/
    ├── app/
    │   ├── [lang]/         # i18n 路由（generateStaticParams）
    │   └── api/convert/    # 图片转换 API（Sharp + Jimp）
    ├── components/
    │   ├── ImageConverter.tsx
    │   ├── SiteHeader.tsx
    │   └── SiteFooter.tsx
    ├── lib/
    │   ├── i18n.ts
    │   └── language.ts
    └── locales/            # 翻译 JSON 文件
```

---

## 环境变量

所有运行时配置通过容器中设置的环境变量完成。  
可在 `wrangler.jsonc` 的 `"vars"` 下设置，或对敏感值使用 `wrangler secret put`。

| 变量 | 默认值 | 描述 |
|---|---|---|
| `PORT` | `3000` | Next.js 服务器监听的端口（必须与 `worker.ts` 中的 `defaultPort` 匹配） |
| `NODE_ENV` | `production` | Node.js 环境 |
| `NEXT_TELEMETRY_DISABLED` | `1` | 禁用 Next.js 遥测 |

---

## 容器配置

`worker.ts` 中的关键设置：

```ts
export class ImgTuneApp extends Container {
  defaultPort = 3000;   // 必须与 Dockerfile 中的 ENV PORT 匹配
  sleepAfter  = "5m";  // 空闲容器在 5 分钟后休眠
}
```

在 `wrangler.jsonc` 中调整 `max_instances` 以控制并发：

```jsonc
"containers": [
  { "class_name": "ImgTuneApp", "max_instances": 5 }
]
```

---

## 转换详情

| 源 → 目标 | 处理器 |
|---|---|
| JPG/PNG → JPG/PNG | Jimp（纯 JS，无原生依赖） |
| 任意 → WebP / GIF | Sharp（原生，在容器中运行） |
| WebP/GIF → JPG/PNG | Sharp（原生，在容器中运行） |

最大上传大小：**10 MB**
