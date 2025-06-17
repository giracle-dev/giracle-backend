FROM oven/bun:latest

WORKDIR /APP

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev
#     && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY bun.lock ./

RUN bun i --production

# ソースコード全部移動
COPY ./ ./

# PrismaORM用のDB設定プッシュ
RUN bunx prisma db push

ENV NODE_ENV production

CMD ["bun", "run", "./src/index.ts"]

EXPOSE 4000