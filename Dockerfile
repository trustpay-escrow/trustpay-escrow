# ==============================================================================
# Multi-Stage Production Dockerfile for TrustPay Escrow
# ==============================================================================

# --- Stage 1: Build Backend ---
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# --- Stage 2: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# --- Stage 3: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy built frontend
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
RUN cd frontend && npm ci --omit=dev

EXPOSE 3000 5000

CMD ["sh", "-c", "node backend/dist/server.js & cd frontend && npm start"]
