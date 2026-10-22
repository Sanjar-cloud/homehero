# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT_API=3007
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Docker initializes a new uploads volume from these owned directories.
# Existing volumes need their own permission check before activation.
RUN mkdir -p uploads/member uploads/service uploads/article uploads/property \
    && chown -R node:node uploads
USER node
EXPOSE 3007
CMD ["node", "dist/apps/homehero-api/main.js"]
