FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts drizzle.config.ts tailwind.config.js postcss.config.js ./
RUN npm ci

COPY src ./src
RUN npm run build:server
RUN npm run build:client

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

RUN mkdir -p /data

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
