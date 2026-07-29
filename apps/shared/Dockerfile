FROM oven/bun:1-alpine AS base

WORKDIR /usr/src/app

FROM base AS install

RUN mkdir -p /temp/dev

COPY package.json bun.lock /temp/dev/
COPY packages /temp/dev/packages
COPY apps/shared/package.json /temp/dev/apps/shared/

RUN cd /temp/dev && bun install

FROM base AS compile

COPY --from=install /temp/dev/package.json .
COPY --from=install /temp/dev/bun.lock .
COPY --from=install /temp/dev/node_modules ./node_modules/
COPY --from=install /temp/dev/packages ./packages/

COPY apps/shared ./apps/shared

RUN bun install

ENV NODE_ENV=production

RUN cd apps/shared && bun run build


# Final image
FROM base AS release

COPY --from=compile /usr/src/app/node_modules ./node_modules
COPY --from=compile /usr/src/app/packages ./packages
COPY --from=compile /usr/src/app/apps/shared/dist ./apps/shared/dist
COPY --from=compile /usr/src/app/apps/shared/package.json ./apps/shared/package.json
COPY --from=compile /usr/src/app/apps/ ./apps/

WORKDIR /usr/src/app/apps/shared

CMD ["bun", "dist/index.mjs"]