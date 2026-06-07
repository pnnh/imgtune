import { Container } from "@cloudflare/containers";

/**
 * ImgTuneApp — Cloudflare Container Durable Object
 *
 * Each instance wraps a running Docker container (built from the project
 * Dockerfile) and proxies all inbound HTTP requests to it on port 3000.
 * Idle containers are put to sleep after 5 minutes to save resources.
 */
export class ImgTuneApp extends Container {
  /** Port the Next.js server inside the container listens on. */
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
