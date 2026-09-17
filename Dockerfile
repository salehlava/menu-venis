# Full application: menu + admin panel + customer club.
# Works on any host that runs Docker (Liara, Chabokan, Hamravesh, a VPS, …).
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY scripts ./scripts

# Live data (menu edits, customers, settings) lives on a mounted disk,
# so it survives restarts and new deployments.
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TRUST_PROXY=1 \
    TIME_ZONE=Asia/Tehran

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server/index.js"]
