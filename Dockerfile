FROM node:18-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate the Prisma Client
RUN npx prisma generate

# Copy source code and build the NestJS application
COPY . .
RUN npm run build

FROM node:18-alpine AS production

RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]