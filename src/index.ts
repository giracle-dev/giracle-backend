import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import {cors} from "@elysiajs/cors";

import { user } from "./components/User/user.module";
import { channel } from "./components/Channel/channel.module";
import { role } from "./components/Role/role.module";

export const app = new Elysia()
  .use(cors(
    {
      origin: Bun.env.CORS_ORIGIN,
    }
  ))
  .use(swagger())
  .onError(({ error, code }) => {
    if (code === "NOT_FOUND") return "Not Found :(";
    console.error(error);
  })
  .use(user)
  .use(channel)
  .use(role)
  .listen(3000);

console.log("Server running at http://localhost:3000");
