FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all deps (including devDependencies for build)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# --- Production stage ---
FROM node:20-slim

# Emoji/CJK fonts so callout glyphs and non-latin text render in the PDF.
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Playwright manages its own Chromium; install it into a shared, root-readable
# path so the (non-root-agnostic) runtime finds it deterministically.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install the Chromium build Playwright expects, plus its OS dependencies.
RUN npx playwright install --with-deps chromium

# Copy built files
COPY --from=builder /app/dist/ ./dist/

# Copy templates and styles (these are runtime assets, not compiled)
COPY templates/ ./templates/
COPY styles/ ./styles/

# Create output and temp directories
RUN mkdir -p /app/output /app/temp

# Environment variables
ENV NODE_ENV=production
ENV OUTPUT_DIR=/app/output
ENV TEMP_DIR=/app/temp
ENV PORT=3000

EXPOSE 3000

# Run the server
CMD ["node", "dist/server.js"]
