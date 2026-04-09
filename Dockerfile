# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# OpenSSL + libc6-compat required by Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Pinned Prisma CLI + tsx for migrate / seed operations
# (Next.js standalone output strips devDependencies, so install them globally here)
# Pre-fetch the Prisma engines as root, then chown so the nextjs user can read/write
RUN npm install -g prisma@5.15.0 tsx@4.11.0 \
    && prisma --version \
    && chown -R nextjs:nodejs /usr/local/lib/node_modules/prisma \
    && chown -R nextjs:nodejs /usr/local/lib/node_modules/@prisma 2>/dev/null || true

# Application runtime files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema + seed script (needed at runtime for migrate/seed)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Prisma engines generated from `prisma generate` - required by @prisma/client at runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# bcryptjs is a dep of seed.ts - standalone bundles it for app but seed runs via tsx outside
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
