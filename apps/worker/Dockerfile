FROM oven/bun:1-alpine AS base

WORKDIR /usr/src/app

FROM base AS install

RUN mkdir -p /temp/dev

COPY package.json bun.lock /temp/dev/
COPY packages /temp/dev/packages
COPY apps/worker/package.json /temp/dev/apps/worker/

RUN cd /temp/dev && bun install

FROM base AS compile

COPY --from=install /temp/dev/package.json .
COPY --from=install /temp/dev/bun.lock .
COPY --from=install /temp/dev/node_modules ./node_modules/
COPY --from=install /temp/dev/packages ./packages/

COPY apps/worker ./apps/worker

RUN bun install

ENV NODE_ENV=production

RUN cd apps/worker && bun run build


# Final image
FROM base AS release

COPY --from=compile /usr/src/app/node_modules ./node_modules
COPY --from=compile /usr/src/app/packages ./packages
COPY --from=compile /usr/src/app/apps/worker/dist ./apps/worker/dist
COPY --from=compile /usr/src/app/apps/worker/package.json ./apps/worker/package.json
COPY --from=compile /usr/src/app/apps/ ./apps/

WORKDIR /usr/src/app/apps/worker

CMD ["bun", "dist/index.mjs"]