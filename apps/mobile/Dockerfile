# Pin it — static web (Expo export). Railway: set service Root Directory to `apps/mobile`.
# Build arg / env EXPO_PUBLIC_API_URL bakes the API host into the bundle (override per env).

FROM node:20-alpine AS builder
WORKDIR /app

ARG EXPO_PUBLIC_API_URL=https://pinned-production-b992.up.railway.app
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
# Static web bundle — must land in ./dist (see Expo: "Exported: dist")
RUN npm run export:web \
  && test -d dist \
  && test -f dist/index.html \
  && ls -la dist

# Small static server; respects Railway PORT
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve@14.2.4 --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 8080
CMD ["sh", "-c", "exec serve -s dist -l \"tcp://0.0.0.0:${PORT:-8080}\""]
