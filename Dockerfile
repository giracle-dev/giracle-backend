FROM oven/bun

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl

COPY package.json .
COPY bun.lock .

RUN bun i --prod

COPY .env .
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json .

ENV NODE_ENV production

RUN bunx prisma db push
RUN bunx prisma generate

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--target bun \
	--outfile server \
	src/index.ts

EXPOSE 3000
RUN ./server