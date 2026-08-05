import { Container } from "@cloudflare/containers";

/**
 * ImgTuneApp — Cloudflare Container Durable Object
 *
 * 每个实例封装一个运行 Docker 容器（由项目 Dockerfile 构建）并将所有入站
 * HTTP 请求代理到容器内 Express.js 服务器（端口 3000）。
 * 容器闲置 5 分钟后进入休眠以节省资源。
 *
 * 注：重构后容器内运行 Express.js（替代原 Next.js），Worker 代理逻辑无需修改。
 */
export class ImgTuneApp extends Container {
  /** Express.js 服务器在容器内监听的端口（与 src/server/index.ts 一致）。 */
  defaultPort = 3000;

  /** Put the container to sleep after 5 minutes of inactivity. */
  sleepAfter = "5m";
}

interface Env {
  /** Binding name must match the durable_objects binding in wrangler.jsonc */
  IMGTUNE_APP: {
    getByName(name: string): {
      fetch(request: Request): Promise<Response>;
    };
  };
}

/**
 * Worker entry point — routes every request to a single container instance
 * identified by the constant name "main".  For multi-tenant or per-user
 * isolation you would derive the name from the request instead.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = env.IMGTUNE_APP.getByName("main");
    return container.fetch(request);
  },
} satisfies ExportedHandler<Env>;
