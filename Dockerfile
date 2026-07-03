# Verity — Docker Build

# Doc 17 §5 (Containerization)
# Uses a multi-stage build tailored for Turborepo and pnpm.
# Produces two production images: web and worker.

# ──────────────────────────────────────────────────────────
# Base — Alpine Node
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat

# ──────────────────────────────────────────────────────────
# Builder — Turborepo Prune
# ──────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
# We use turbo prune to isolate the target app's dependencies
# Example: ARG APP_NAME=web
ARG APP_NAME=web
RUN turbo prune --scope=@verity/${APP_NAME} --docker

# ──────────────────────────────────────────────────────────
# Installer — Install & Build
# ──────────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app

# Install dependencies based on the pruned lockfile
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
ARG APP_NAME=web
# Build using turbo
RUN pnpm turbo run build --filter=@verity/${APP_NAME}...

# ──────────────────────────────────────────────────────────
# Runner Web — Next.js Standalone (Doc 17 §5.1)
# ──────────────────────────────────────────────────────────
FROM base AS runner-web
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/web/next.config.ts .
COPY --from=installer /app/apps/web/package.json .

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ──────────────────────────────────────────────────────────
# Runner Worker — Node.js script (Doc 17 §5.1)
# ──────────────────────────────────────────────────────────
FROM base AS runner-worker
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker
USER worker

# Copy the built worker dist and the required node_modules
# (In a real monorepo setup, you might need to bundle the worker or copy the workspace root node_modules)
COPY --from=installer --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=installer --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=installer --chown=worker:nodejs /app/node_modules ./node_modules
# Would likely need to bundle using esbuild/tsup for the worker to avoid complex monorepo node_modules copying,
# but for now, assuming standard node execution.

WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
