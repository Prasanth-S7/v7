FROM oven/bun:1-alpine AS base

WORKDIR /usr/src/app

FROM base AS install

RUN mkdir -p /temp/dev

COPY package.json bun.lock /temp/dev/
COPY packages /temp/dev/packages
COPY apps/sse/package.json /temp/dev/apps/sse/

RUN cd /temp/dev && bun install

FROM base AS compile

COPY --from=install /temp/dev/package.json .
COPY --from=install /temp/dev/bun.lock .
COPY --from=install /temp/dev/node_modules ./node_modules/
COPY --from=install /temp/dev/packages ./packages/

COPY apps/sse ./apps/sse

RUN bun install

ENV NODE_ENV=production

RUN cd apps/sse && bun run build


# Final image
FROM base AS release

COPY --from=compile /usr/src/app/node_modules ./node_modules
COPY --from=compile /usr/src/app/packages ./packages
COPY --from=compile /usr/src/app/apps/sse/dist ./apps/sse/dist
COPY --from=compile /usr/src/app/apps/sse/package.json ./apps/sse/package.json
COPY --from=compile /usr/src/app/apps/ ./apps/

WORKDIR /usr/src/app/apps/sse
EXPOSE 3002

CMD ["bun", "dist/index.mjs"]