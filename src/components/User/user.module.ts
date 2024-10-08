import { PrismaClient } from "@prisma/client";
import Elysia from "elysia";
import { userService, getUserId } from "./user.service";

const db = new PrismaClient();

export const user = new Elysia({ prefix: "/user" })
  .use(userService)
  .put(
    "/sign-up",
    async ({ body: { username, password }, store, error }) => {
      if (store.user[username])
        return error(400, {
          success: false,
          message: "User already exists",
        });

      store.user[username] = await Bun.password.hash(password);

      return {
        success: true,
        message: "User created",
      };
    },
    {
      body: "signIn",
    },
  )
  .post(
    "/sign-in",
    async ({
      store: { user, session },
      error,
      body: { username, password },
      cookie: { token },
    }) => {
      if (
        !user[username] ||
        !(await Bun.password.verify(password, user[username]))
      )
        return error(400, {
          success: false,
          message: "Invalid username or password",
        });

      const key = crypto.getRandomValues(new Uint32Array(1))[0];
      session[key] = username;
      token.value = key;

      return {
        success: true,
        message: `Signed in as ${username}`,
      };
    },
    {
      body: "signIn",
      cookie: "optionalSession",
    },
  )
  .get(
    "/sign-out",
    ({ cookie: { token } }) => {
      token.remove();

      return {
        success: true,
        messaage: "Signed out",
      };
    },
    {
      cookie: "optionalSession",
    },
  )
  .use(getUserId)
  .get("/profile", ({ username }) => ({
    success: true,
    username,
  }));
