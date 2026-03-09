# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./

RUN npx mastra build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/.mastra/output ./.mastra/output

EXPOSE 4111

ENV NODE_ENV=production

CMD ["node", ".mastra/output/index.mjs"]
