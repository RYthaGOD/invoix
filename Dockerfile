# Base Image
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Install dependencies (incorporating apt packages if needed, though pure node seems fine)
# If native modules are needed, uncomment:
# RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install NPM dependencies
# using 'install' instead of 'ci' because package-lock.json is out of sync
# using '--legacy-peer-deps' to resolve metaplex version conflicts
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune development dependencies to keep production image small
RUN npm prune --production --legacy-peer-deps

# --- Production Stage ---
FROM node:20-slim

WORKDIR /app

# Set environment variable for production
ENV NODE_ENV=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 5000

# Set environment variable for production
ENV NODE_ENV=production

# Start command - DIRECT execution to save memory (avoids npm/shell overhead)
# We keep the memory limit (460MB) to match the Railway starter plan (512MB RAM)
CMD ["node", "--max-old-space-size=460", "dist/index.js"]
