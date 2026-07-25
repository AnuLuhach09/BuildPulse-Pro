FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ── Development stage ──────────────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── Build stage ────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production Dependencies stage ──────────────────────────────────────────────
FROM base AS prod-dependencies
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate

# ── Production stage ──────────────────────────────────────────────────────────
# WHY multi-stage: production image only contains compiled JS, not
# TypeScript source, devDependencies, or build tools. Smaller image = 
# smaller attack surface and faster deploys.
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Run as non-root user for security
RUN addgroup -S buildpulse && adduser -S buildpulse -G buildpulse
USER buildpulse

EXPOSE 4000
CMD ["node", "dist/server.js"]
