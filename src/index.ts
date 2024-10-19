import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

import { channel } from "./components/Channel/channel.module";
import { message } from "./components/Message/message.module";
import { role } from "./components/Role/role.module";
import { user } from "./components/User/user.module";
import { wsHandler } from "./ws";

//アイコン用のディレクトリ作成
import { mkdir } from "node:fs/promises";
import { server } from "./components/Server/server.module";
await mkdir("./STORAGE", { recursive: true });
await mkdir("./STORAGE/icon", { recursive: true });
await mkdir("./STORAGE/banner", { recursive: true });

export const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN,
    }),
  )
  .use(swagger())
  .onError(({ error, code }) => {
    if (code === "NOT_FOUND") return "Not Found :(";
    console.error(error);
  })
  .use(wsHandler)
  .use(user)
  .use(channel)
  .use(role)
  .use(message)
  .use(server)
  .listen(3000);

console.log("Server running at http://localhost:3000");
