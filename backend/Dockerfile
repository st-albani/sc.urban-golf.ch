# Backend Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root package files and every workspace's package.json so npm can
# resolve the full workspace graph (backend depends on @urban-golf/contract
# via the packages/* workspace).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/contract/ ./packages/contract/

# Install only backend production dependencies, plus the shared contract.
RUN npm ci --workspace=backend --workspace=@urban-golf/contract --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy hoisted node_modules + packages/ from workspace install so the
# symlinked @urban-golf/contract resolves at runtime.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy backend source code (flat layout: backend/ contents → /app/)
COPY backend/ .

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "app.js"]
