FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8085
EXPOSE 8085

USER node

CMD ["node", "server.js"]
