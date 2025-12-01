import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { PrismaClient } from "../prisma/generated/client";
import { rateLimiter } from "./Middlewares";

import { channel } from "./components/Channel/channel.module";
import { message } from "./components/Message/message.module";
import { role } from "./components/Role/role.module";
import { user } from "./components/User/user.module";
import { server } from "./components/Server/server.module";
import { wsHandler } from "./ws";

//ユーザーアップロード用のディレクトリ作成
import { mkdir } from "node:fs/promises";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
await mkdir("./STORAGE", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/file", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/icon", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/banner", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/custom-emoji", { recursive: true }).catch((e) => {});

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
export const db = new PrismaClient({ adapter });

export const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN,
    }),
  )
  .use(Bun.env.RATE_LIMIT_ENABLED === "true" ? rateLimiter : undefined)
  .onError(({ error, code }) => {
    if (code === "NOT_FOUND") return "Not Found :(";
    console.error("index :: エラー->", error);
  })
  .use(wsHandler)
  .use(user)
  .use(channel)
  .use(role)
  .use(message)
  .use(server)
  .listen(3000);

console.log("Server running at http://localhost:3000");
