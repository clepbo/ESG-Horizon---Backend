# Production image for the ESG Horizon demo API.
#
# The runtime stage deliberately keeps the full dependency tree rather than
# pruning to production-only: the demo seeds run through ts-node at container
# start, so the TypeScript toolchain has to be present.

FROM node:22-slim AS builder
WORKDIR /app

# Prisma's query engine links against OpenSSL, which node:22-slim omits.
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Corepack pins yarn to the version in package.json#packageManager.
RUN corepack enable

COPY package.json .yarnrc.yml ./
# yarn.lock is gitignored in this repo, so the install cannot be --immutable.
RUN yarn install --network-timeout 600000

COPY . .

# `yarn build` runs `prisma generate && nest build`.
RUN yarn build

FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.yarnrc.yml ./
COPY --from=builder /app/tsconfig.json ./

# Render (and most PaaS) inject PORT; main.ts already honours it.
EXPOSE 3000

# Migrate, seed reference data, seed the demo tenant, then serve.
# All three seed steps are safe to repeat: migrate deploy is idempotent, the
# base seed upserts, and the demo seed refuses to run if its tenant exists.
# The seeds are intentionally not fatal — if one fails the API still starts, so
# the container does not crash-loop and the logs stay readable.
# Invoke the locally installed binaries directly rather than through yarn:
# corepack would try to fetch the yarn release on first use, making container
# start depend on network access to the yarn registry.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/ts-node prisma/seed.ts && ./node_modules/.bin/ts-node prisma/demo-seed.ts; node dist/src/main.js"]
