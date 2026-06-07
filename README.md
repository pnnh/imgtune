# ImgTune

A multilingual image format conversion tool built with [Next.js](https://nextjs.org), deployed on **Cloudflare Containers**.

Supported conversions: **JPG ↔ PNG ↔ WebP ↔ GIF**  
Supported languages: English, 简体中文, 繁體中文, 日本語, Deutsch, Español, Français, Português

---

## How It Works

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 16 (App Router) | UI, i18n routing, file upload |
| API | `src/app/api/convert/route.ts` | Image conversion via **Sharp** + **Jimp** |
| Runtime | Docker container (Node.js 22) | Runs the Next.js standalone server |
| Edge entry | Cloudflare Worker (`worker.ts`) | Thin proxy routing traffic to the container |
| Platform | Cloudflare Containers | Manages container lifecycle at the edge |

The `sharp` library requires native C++ bindings and cannot run inside a Cloudflare Worker (V8 isolate).  
Deploying as a **Cloudflare Container** gives a full Node.js runtime where native modules work normally.

---

## Local Development

```bash
# Install dependencies (first time or after adding packages)
pnpm install

# Start the Next.js dev server on port 7412
pnpm dev
```

Open [http://localhost:7412](http://localhost:7412) in your browser.

---

## Deployment to Cloudflare Containers

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4+ (`pnpm add -g wrangler`)
- [Docker](https://docs.docker.com/get-docker/) installed and running (used by `wrangler deploy` to build the container image)
- A Cloudflare account with **Containers** enabled (open beta — enable in the Cloudflare dashboard)

### Authenticate

```bash
wrangler login
```

### First deploy

```bash
pnpm deploy
# Equivalent to: pnpm build && wrangler deploy
```

`wrangler deploy` will:

1. Build the Next.js app (`next build` → `.next/standalone`)
2. Build the Docker image from `./Dockerfile`
3. Push the container image to Cloudflare's registry
4. Deploy the Worker proxy (`worker.ts`)
5. Register the `ImgTuneApp` Durable Object migration

### Subsequent deploys

```bash
pnpm deploy
```

## GitHub Actions Auto Deploy

This repository includes an automated deployment workflow:

- Workflow file: `.github/workflows/deploy-cloudflare-containers.yml`
- Trigger: push to `main` and manual `workflow_dispatch`
- Flow: install dependencies -> build Next.js -> run `wrangler deploy`

### Required GitHub Secrets

Add the following repository secrets in GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Recommended API token permissions:

- Workers Scripts: Edit
- Workers Routes: Edit
- Workers Tail: Read (optional)
- Account-level permissions required by Cloudflare Containers deployment

### CI Deploy Behavior

On every push to `main`, GitHub Actions will:

1. Install pnpm dependencies from lockfile
2. Build the standalone Next.js output
3. Build the Docker image in the runner
4. Deploy the Worker + Container via Wrangler

If deployment fails, check the workflow logs in GitHub Actions and verify the Cloudflare token scope and account id.

### Preview locally with Wrangler

> **Note:** Full Container emulation requires Docker. The command below starts the Worker portion only.

```bash
pnpm cf:preview   # wrangler dev
```

---

## Project Structure

```
imgtune/
├── Dockerfile              # Multi-stage image: deps → build → runner
├── .dockerignore
├── worker.ts               # Cloudflare Worker proxy (entry point for wrangler)
├── wrangler.jsonc          # Cloudflare deployment config (Container + DO binding)
├── next.config.ts          # Next.js config — output: "standalone"
├── package.json
├── public/
└── src/
    ├── app/
    │   ├── [lang]/         # i18n route (generateStaticParams)
    │   └── api/convert/    # Image conversion API (Sharp + Jimp)
    ├── components/
    │   ├── ImageConverter.tsx
    │   ├── SiteHeader.tsx
    │   └── SiteFooter.tsx
    ├── lib/
    │   ├── i18n.ts
    │   └── language.ts
    └── locales/            # Translation JSON files
```

---

## Environment Variables

All runtime configuration is via environment variables set in the container.  
Set them in `wrangler.jsonc` under `"vars"` or use `wrangler secret put` for sensitive values.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the Next.js server listens on (must match `defaultPort` in `worker.ts`) |
| `NODE_ENV` | `production` | Node.js environment |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |

---

## Container Configuration

Key settings in `worker.ts`:

```ts
export class ImgTuneApp extends Container {
  defaultPort = 3000;   // Must match ENV PORT in Dockerfile
  sleepAfter  = "5m";  // Idle containers sleep after 5 minutes
}
```

Scale `max_instances` in `wrangler.jsonc` to control concurrency:

```jsonc
"containers": [
  { "class_name": "ImgTuneApp", "max_instances": 5 }
]
```

---

## Conversion Details

| Source → Target | Processor |
|---|---|
| JPG/PNG → JPG/PNG | Jimp (pure JS, no native deps) |
| Any → WebP / GIF | Sharp (native, runs in container) |
| WebP/GIF → JPG/PNG | Sharp (native, runs in container) |

Maximum upload size: **10 MB**

