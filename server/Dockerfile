# Warranty Void game server. Build from the REPO ROOT:  docker build -f server/Dockerfile -t wv-hub .
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY server ./server
COPY tsconfig.json ./
# single-file bundle (ws included); optional native accelerators are not needed
RUN npx esbuild server/main.ts --bundle --platform=node --format=esm --target=node20 --banner:js="import {createRequire as __cr} from 'module'; const require=__cr(import.meta.url);" --external:bufferutil --external:utf-8-validate --outfile=/out/server.mjs --log-level=warning

FROM node:20-slim
ENV NODE_ENV=production PORT=8787
WORKDIR /srv
COPY --from=build /out/server.mjs ./server.mjs
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# SIGTERM (ECS stop / docker stop) triggers graceful drain: /healthz -> 503, instances ended, then exit
STOPSIGNAL SIGTERM
CMD ["node", "server.mjs"]
