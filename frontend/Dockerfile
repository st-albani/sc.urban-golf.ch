# Frontend Dockerfile
FROM node:24-alpine AS deps
WORKDIR /app

# Copy root package files and every workspace's package.json so npm can
# resolve the full workspace graph (frontend depends on @urban-golf/contract
# via the packages/* workspace).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/contract/ ./packages/contract/

# Install frontend + the shared contract workspace (devDependencies included
# for the vite build).
#
# mkdir: npm hebt Workspace-Abhängigkeiten nur so weit ins Root-node_modules,
# wie es kollisionsfrei geht — bei einem Versionskonflikt landen sie stattdessen
# unter frontend/node_modules. Das Verzeichnis muss deshalb existieren, damit
# der COPY im builder-Stage nicht davon abhängt, wie npm gerade auflöst.
RUN npm ci --workspace=frontend --workspace=@urban-golf/contract \
 && mkdir -p /app/frontend/node_modules

FROM node:24-alpine AS builder
WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_BASEURL
ENV VITE_API_BASEURL=$VITE_API_BASEURL

# Copy node_modules + packages/ from workspace install so the symlinked
# @urban-golf/contract resolves at build time.
COPY --from=deps /app/node_modules ./node_modules
# Die nicht gehoisteten Pakete darüberlegen. Der Source liegt hier flach unter
# /app/, es gibt also nur eine Auflösungsebene — und genau die muss der Sicht des
# frontend-Workspace entsprechen, wo Genestetes das Gehoistete überschattet.
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy frontend source code (flat layout: frontend/ contents → /app/)
COPY frontend/ .

# Build frontend
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown -R nginx-app:nginx-app /var/run/nginx.pid

USER nginx-app
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
