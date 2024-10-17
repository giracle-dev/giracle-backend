import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

import { channel } from "./components/Channel/channel.module";
import { role } from "./components/Role/role.module";
import { user } from "./components/User/user.module";
import { wsHandler } from "./ws";
import { message } from "./components/Message/message.module";

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
  .listen(3000);

console.log("Server running at http://localhost:3000");
