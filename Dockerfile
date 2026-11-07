# ==============================================================================
# Multi-stage Dockerfile für WikiAlternative
# Läuft effizient auf Debian (CasaOS), x86_64 und ARM64
# ==============================================================================

# Stufe 1: Build & Native Dependencies (better-sqlite3)
FROM node:18-bookworm-slim AS builder

WORKDIR /app

# Erforderliche Build-Werkzeuge für C/C++ SQLite-Bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# Stufe 2: Schlankes Produktions-Image
FROM node:18-bookworm-slim

WORKDIR /app

# Curl für Docker Healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Datenverzeichnisse vorbereiten
RUN mkdir -p /app/data/uploads

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "src/server/index.js"]

