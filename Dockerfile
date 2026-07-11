# Stage 1: Build dependencies
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production environment runner
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy necessary configuration files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/server.js ./

# Copy built Next.js pages and routes
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Copy source files because ts-node registers src/socket files at runtime
COPY --from=builder /app/src ./src

# Install production dependencies and ts-node/typescript runtime deps
RUN npm ci --only=production && \
    npm install -g ts-node typescript tsconfig-paths

EXPOSE 3000
CMD ["node", "server.js"]
