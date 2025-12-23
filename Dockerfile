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
# This runs "vite build" (client) and "tsx server/build.ts" (server)
# We pass benign values for build-time variables if Vite needs them, 
# but runtime vars come from the environment at startup.
RUN npm run build

# --- Production Stage ---
FROM node:20-slim

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy migrations explicitly if they aren't bundled (build.ts copies them, but let's be safe)
# server/build.ts copies them to dist/migrations, so we are good.

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
