FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN bun i

COPY src ./src
COPY tsconfig.json .

ENV NODE_ENV production

CMD ["bun", "run", "./src/index.ts"]

EXPOSE 3000