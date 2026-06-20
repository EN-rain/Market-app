# syntax=docker/dockerfile:1.7
# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install OS deps for bcrypt/prisma
RUN apk add --no-cache openssl

# Install deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# Generate prisma client + build TS
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV RUN_MIGRATIONS_ON_START=false
ENV HEALTH_CHECK_DB=false

RUN apk add --no-cache openssl wget

# Copy production deps + built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Render injects PORT at runtime; migrations can be enabled for deploys that need them.
CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS_ON_START:-false}\" = \"true\" ]; then npx prisma migrate deploy; fi && node dist/main.js"]
