# Stage 1: Install dependencies
FROM node:20-slim AS deps
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Stage 2: Build the application
FROM node:20-slim AS builder
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production image
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma requires openssl on Debian; ca-certificates for HTTPS (engine downloads)
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (node:20-slim doesn't have /etc/adduser.conf, use useradd)
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home /home/nextjs --create-home nextjs

# Pinned Prisma CLI + tsx for migrate / seed. Pre-fetch engines, then chown
# the global install so the non-root nextjs user can read/write them.
RUN npm install -g prisma@5.15.0 tsx@4.11.0 \
    && prisma --version \
    && chown -R nextjs:nodejs /usr/local/lib/node_modules/prisma \
    && ( [ -d /usr/local/lib/node_modules/@prisma ] && chown -R nextjs:nodejs /usr/local/lib/node_modules/@prisma || true )

# Application runtime files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema + seed script (needed at runtime for migrate / seed)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Prisma engines generated from `prisma generate` — required by @prisma/client at runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# bcryptjs is imported by prisma/seed.ts (which runs via tsx outside the Next bundle)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
