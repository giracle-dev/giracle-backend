FROM oven/bun:latest

WORKDIR /APP

COPY package.json ./
COPY bun.lock ./

RUN bun i --production

# ソースコード全部移動
COPY ./ ./

ENV NODE_ENV production

CMD ["bun", "run", "./src/index.ts"]

EXPOSE 4000