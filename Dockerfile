# =========================================================
# Stage 1: Install dependencies
# =========================================================
FROM node:22-slim AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# =========================================================
# Stage 2: Build frontend (Vite) and backend (tsc)
# =========================================================
FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build:web && pnpm build:server

# =========================================================
# Stage 3: Production runner (Express)
# =========================================================
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN corepack enable

# 仅复制生产依赖
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# 重新编译 Sharp 的原生 C++ 扩展以匹配运行时平台
RUN npm rebuild sharp

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3000

CMD ["node", "dist-server/index.js"]
