import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import { userService } from "./user.service";

const db = new PrismaClient();

export const user = new Elysia({ prefix: "/user" })
  .use(userService)
  .put(
    "/sign-up",
    async ({ body: { username, password }, error }) => {
      const user = await db.user.findUnique({
        where: { name: username },
      });
      if (user) {
        return error(400, {
          success: false,
          message: "User already exists",
        });
      }

      //ソルト生成、パスワードのハッシュ化
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHashed = await Bun.password.hash(password + salt);
      //DBへユーザー情報を登録
      await db.user.create({
        data: {
          name: username,
          selfIntroduction: `こんにちは、${username}です。`,
          password: {
            create: {
              password: passwordHashed,
              salt: salt,
            },
          },
        },
      });

      //store.user[username] = await Bun.password.hash(password);

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
    async ({ error, body: { username, password }, cookie: { token } }) => {
      //ユーザー情報取得
      const user = await db.user.findUnique({
        where: { name: username },
        include: {
          password: true,
        },
      });

      //ユーザーが存在しない場合
      if (!user) {
        return error(400, {
          success: false,
          message: "Auth info is incorrect",
        });
      }
      //パスワードが設定されていない場合
      if (!user.password) {
        return error(400, {
          success: false,
          message: "Interlal error",
        });
      }

      //パスワードのハッシュ化
      const passwordCheckResult = await Bun.password.verify(
        password + user.password?.salt,
        user.password.password,
      );

      //パスワードが一致しない場合
      if (!passwordCheckResult) {
        return error(400, {
          success: false,
          message: "Auth info is incorrect",
        });
      }

      //トークンを生成
      const tokenGenerated = await db.token.create({
        data: {
          token: crypto.randomBytes(16).toString("hex"),
          user: {
            connect: {
              name: username,
            },
          },
        },
      });
      //console.log("user.module :: /sign-in :: tokenGenerated", tokenGenerated);
      //クッキーに格納
      token.value = tokenGenerated.token;
      token.httpOnly = true;
      token.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); //15日間有効

      return {
        success: true,
        message: `Signed in as ${username}`,
      };
    },
    {
      body: "signIn",
      cookie: t.Cookie({ token: t.Optional(t.String()) }),
    },
  )
  .get(
    "/sign-out",
    async ({ cookie: { token } }) => {
      await db.token.deleteMany({
        where: {
          token: token.value,
        },
      });

      token.remove();

      return {
        success: true,
        message: "Signed out",
      };
    },
    {
      cookie: t.Cookie({ token: t.String() }),
    },
  );
