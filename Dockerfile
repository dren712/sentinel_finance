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

# Build-time arguments with production Solana Devnet defaults
ARG NEXT_PUBLIC_SOLANA_CLUSTER=devnet
ARG NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
ARG NEXT_PUBLIC_SENTINEL_PROGRAM_ID=3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK
ARG NEXT_PUBLIC_LIVE_PRICES=true
ARG NEXT_PUBLIC_DEMO_MODE=true

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_SOLANA_CLUSTER=$NEXT_PUBLIC_SOLANA_CLUSTER
ENV NEXT_PUBLIC_SOLANA_RPC=$NEXT_PUBLIC_SOLANA_RPC
ENV NEXT_PUBLIC_SENTINEL_PROGRAM_ID=$NEXT_PUBLIC_SENTINEL_PROGRAM_ID
ENV NEXT_PUBLIC_LIVE_PRICES=$NEXT_PUBLIC_LIVE_PRICES
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE

# Build Next.js application in production mode
RUN pnpm --filter @sentinel/web run build

# -----------------------------------------------------------------------------
# Runner stage: Lightweight production runtime
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="Sentinel Finance"
LABEL org.opencontainers.image.description="Autonomous Robo-Portfolio & On-Chain Policy Guard for Tokenized Stocks on Solana"
LABEL org.opencontainers.image.source="https://github.com/dren712/sentinel_finance"

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SOLANA_CLUSTER=devnet
ENV NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
ENV NEXT_PUBLIC_SENTINEL_PROGRAM_ID=3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK
ENV SOLANA_RPC_URL=https://api.devnet.solana.com
ENV SENTINEL_PROGRAM_ID=3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK
ENV NEXT_PUBLIC_LIVE_PRICES=true
ENV NEXT_PUBLIC_DEMO_MODE=true
ENV PYTH_HERMES_URL=https://hermes.pyth.network

# Create unprivileged application user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy built application and workspace from builder
COPY --from=builder --chown=nextjs:nodejs /app ./

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@sentinel/web", "run", "start"]

