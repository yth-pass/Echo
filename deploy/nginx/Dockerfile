# ==============================================================================
# Echo Nginx Image — builds frontend + serves static files + reverse proxy
# ==============================================================================

# ---------- Stage 1: Build frontend ----------
FROM node:22-slim AS frontend-builder

WORKDIR /app

# Install frontend dependencies
COPY Echo/package.json Echo/package-lock.json* ./
RUN npm install --legacy-peer-deps

# Set API URL for production (Nginx reverse proxy on same origin)
# Override via --build-arg VITE_API_BASE_URL=https://your-domain.com/v1 if needed
ARG VITE_API_BASE_URL=/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the Vite app
COPY Echo/ ./
RUN npm run build

# ---------- Stage 2: Nginx + frontend ----------
FROM nginx:1.27-alpine

# Remove default config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy frontend build output
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy Nginx configs
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/conf.d/ /etc/nginx/conf.d/

# Create SSL directory (mount certs at runtime)
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
