
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


FROM node:18-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

# copy simulator static files into the production image so the API can serve them
COPY --from=builder /app/simulator ./dist/simulator

EXPOSE 3002

CMD ["node", "dist/server.js"]