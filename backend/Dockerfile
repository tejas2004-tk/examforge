FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "npx prisma generate && node dist/server.js"]
