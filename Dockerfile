# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY tracer-sdk/package.json tracer-sdk/package-lock.json ./tracer-sdk/

# Install all dependencies (including devDeps for build)
RUN npm ci --ignore-scripts
RUN cd tracer-sdk && npm ci --ignore-scripts

# ─── Stage 2: Build the application ────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/tracer-sdk/node_modules ./tracer-sdk/node_modules
COPY . .

# Build the tracer-sdk first (Next.js transpiles it, but dist is needed for external consumers)
RUN cd tracer-sdk && npx tsup src/index.ts --format esm,cjs --dts --clean

# Build Next.js in standalone mode
RUN npm run build

# ─── Stage 3: Production runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy static assets
COPY --from=builder /app/public ./public

# Copy tracer-sdk source (needed for path alias resolution in standalone)
COPY --from=builder /app/tracer-sdk ./tracer-sdk

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
