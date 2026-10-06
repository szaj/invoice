# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate && pnpm build

FROM base AS runner-web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Prisma 7 custom output (schema: src/generated/prisma) — not node_modules/.prisma
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
# migrate deploy needs Prisma 7 config + dotenv loader; runtime needs adapter/pg
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/config/load-env-files.ts ./src/config/load-env-files.ts
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY deploy/docker-entrypoint-web.sh /usr/local/bin/docker-entrypoint-web.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-web.sh
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint-web.sh"]

FROM base AS runner-worker
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json tsconfig.worker.json ./
COPY instrumentation.ts sentry.server.config.ts sentry.edge.config.ts ./
RUN pnpm prisma generate
USER worker
CMD ["pnpm", "worker"]
