# syntax=docker/dockerfile:1

# Development image for the Vite frontend. Source code is bind-mounted by
# Docker Compose for hot reload; dependencies stay inside the image.
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
RUN npm ci && mkdir -p apps/client/node_modules apps/server/node_modules

FROM base AS development
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=deps /app/apps/client/node_modules ./apps/client/node_modules
COPY --chown=node:node package.json tsconfig.base.json ./
COPY --chown=node:node apps/client ./apps/client
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@sweety/client", "--", "--host", "0.0.0.0", "--port", "5173"]
