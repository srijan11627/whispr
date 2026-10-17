# ---- build the React client ----
FROM node:20 AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- run the Node server (libsql ships prebuilds — no build tools needed) ----
FROM node:20-slim
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
# the server serves ../client/dist on its single port
COPY --from=build /app/client/dist /app/client/dist
ENV PORT=5000
EXPOSE 5000
CMD ["node", "src/index.js"]
