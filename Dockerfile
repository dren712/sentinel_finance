# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Base stage: Node 20 Debian Slim (glibc - fast, reliable, standard binaries)
# -----------------------------------------------------------------------------
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9
WORKDIR /app

# -----------------------------------------------------------------------------
# Dependencies stage: Install workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy individual package manifests
COPY packages/domain/package.json ./packages/domain/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/web/package.json ./apps/web/

# Configure pnpm network reliability and install dependencies
RUN pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder stage: Build domain, sdk, and Next.js web application
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy installed node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/packages/sdk/node_modules ./packages/sdk/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source tree
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY packages/sdk ./packages/sdk
COPY apps/web ./apps/web

# Build internal packages
RUN pnpm --filter @sentinel/domain run build
RUN pnpm --filter @sentinel/sdk run build

# Build Next.js application in production mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter @sentinel/web run build

# -----------------------------------------------------------------------------
# Runner stage: Lightweight production runtime
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create unprivileged application user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy built application and workspace from builder
COPY --from=builder --chown=nextjs:nodejs /app ./

USER nextjs

EXPOSE 3000

CMD ["pnpm", "--filter", "@sentinel/web", "run", "start"]
