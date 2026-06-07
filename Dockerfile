# =========================================================
# Stage 1: Install dependencies
# =========================================================
FROM node:22-slim AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
# Install all deps (including devDeps needed by the builder stage)
RUN pnpm install --frozen-lockfile

# =========================================================
# Stage 2: Build Next.js application
# =========================================================
FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# =========================================================
# Stage 3: Production runner (minimal image)
# =========================================================
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Port and hostname must match the Cloudflare Container binding
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The standalone output includes only the necessary runtime files.
# node_modules for native addons (e.g. sharp) are embedded in the
# standalone output's own node_modules tree.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Next.js standalone entry point
CMD ["node", "server.js"]
