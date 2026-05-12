
FROM node:18-alpine AS builder

WORKDIR /app

# copy only this service's package files (build context is repository root)
COPY dummy-api-service/package*.json ./
RUN npm install

# copy service source files
COPY dummy-api-service/. ./

# copy top-level simulator static files into the builder so we can include them in the final image
COPY simulator ./simulator

# compile TypeScript to JavaScript
RUN npm run build


FROM node:18-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY dummy-api-service/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

# copy simulator static files into the production image so the API can serve them
COPY --from=builder /app/simulator ./dist/simulator

EXPOSE 3002

CMD ["node", "dist/server.js"]