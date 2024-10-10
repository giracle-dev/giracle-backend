import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

import { user } from "./components/User/user.module";
import { channel } from "./components/Channel/channel.module";

export const app = new Elysia()
  .use(swagger())
  .onError(({ error, code }) => {
    if (code === "NOT_FOUND") return "Not Found :(";

    console.error(error);
  })
  .use(user)
  .use(channel)
  .listen(3000);

console.log("Server running at http://localhost:3000");
