FROM oven/bun:1-alpine AS base

WORKDIR /usr/src/app

FROM base AS install

RUN mkdir -p /temp/dev

COPY package.json bun.lock /temp/dev/
COPY packages /temp/dev/packages
COPY apps/agent/package.json /temp/dev/apps/agent/

RUN cd /temp/dev && bun install

FROM base AS compile

COPY --from=install /temp/dev/package.json .
COPY --from=install /temp/dev/bun.lock .
COPY --from=install /temp/dev/node_modules ./node_modules/
COPY --from=install /temp/dev/packages ./packages/

COPY apps/agent ./apps/agent

RUN bun install

ENV NODE_ENV=production

RUN cd apps/agent && bun run build


# Final image
FROM base AS release

COPY --from=compile /usr/src/app/node_modules ./node_modules
COPY --from=compile /usr/src/app/packages ./packages
COPY --from=compile /usr/src/app/apps/agent/dist ./apps/agent/dist
COPY --from=compile /usr/src/app/apps/agent/package.json ./apps/agent/package.json
COPY --from=compile /usr/src/app/apps/ ./apps/

WORKDIR /usr/src/app/apps/agent

CMD ["bun", "dist/index.mjs"]