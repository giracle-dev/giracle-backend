import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { rateLimiter } from "./Middlewares";

import { channel } from "./components/Channel/channel.module";
import { message } from "./components/Message/message.module";
import { role } from "./components/Role/role.module";
import { user } from "./components/User/user.module";
import { server } from "./components/Server/server.module";
import { notification } from "./components/Notification/notification.module";
import { wsHandler } from "./ws";
import { apnsService } from "./Utils/APNs";

//ユーザーアップロード用のディレクトリ作成
import { mkdir } from "node:fs/promises";
await mkdir("./STORAGE", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/file", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/icon", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/banner", { recursive: true }).catch((e) => {});
await mkdir("./STORAGE/custom-emoji", { recursive: true }).catch((e) => {});

// APNs初期化
await apnsService.initialize();

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
  .use(notification)
  .listen(3000);

console.log("Server running at http://localhost:3000");
