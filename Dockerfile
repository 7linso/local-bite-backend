# --- Dev deps (for nodemon etc.)
FROM node:20-alpine AS devdeps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# --- Prod deps (no devDependencies)
FROM node:20-alpine AS proddeps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Production runtime
FROM node:20-alpine AS prod
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=proddeps /usr/src/app/node_modules ./node_modules
COPY . .
EXPOSE 3000

CMD ["nodemon", "src/index.js"]
