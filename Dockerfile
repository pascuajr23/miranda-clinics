# Miranda Clinics: website, TV queue display and control panel. No npm dependencies.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_FILE=/app/data/rooms.json

WORKDIR /app
COPY server.js ./
COPY public ./public

# Queue data lives in a volume so it survives image updates; run as the unprivileged "node" user.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
USER node

EXPOSE 3000
# ADMIN_USER / ADMIN_PASSWORD come from the container environment (docker run -e / --env-file, compose, etc.).
CMD ["node", "server.js"]
