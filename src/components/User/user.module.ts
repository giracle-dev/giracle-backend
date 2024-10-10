import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import { userService } from "./user.service";
import CheckToken from "../../Middlewares";

const db = new PrismaClient();

export const user = new Elysia({ prefix: "/user" })
  .use(userService)
  .use(CheckToken)
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
  .post(
    "/change-password",
    async ({ error, body:{currentPassword, newPassword}, _userId }) => {
      //console.log("user.module :: /sign-in :: tokenGenerated", tokenGenerated);
      //ユーザー情報取得
      const userdata = await db.user.findFirst({
        where: {
          id: _userId,
        },
        include: {
          password: true,
        },
      });
      //ユーザー情報、またはその中のパスワードが取得できない場合
      if (userdata === null || userdata.password === null) {
        return error(500, "Internal Server Error");
      }

      //現在のパスワードが正しいか確認
      const passwordCheckResult = await Bun.password.verify(
        currentPassword + userdata.password.salt,
        userdata.password.password,
      );
      //パスワードが一致しない場合
      if (!passwordCheckResult) {
        return error(401, {
          success: false,
          message: "Current password is incorrect",
        });
      }

      //新しいパスワードをハッシュ化してDBに保存
      await db.password.update({
        where: {
          userId: userdata.id,
        },
        data: {
          password: await Bun.password.hash(newPassword + userdata.password.salt),
        },
      });

      return {
        success: true,
        message: "Password changed",
      };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 4 }),
        newPassword: t.String({ minLength: 4 }),
      }),
      cookie: t.Cookie({ token: t.String() }),
    },
  )
  .get(
    "/sign-out",
    async ({ cookie: { token } }) => {
      //トークン削除
      await db.token.delete({
        where: {
          token: token.value,
        },
      });

      //クッキー削除
      token.remove();

      return {
        success: true,
        message: "Signed out",
      };
    },
    {
      cookie: t.Cookie({ token: t.String() }),
    },
  )
  .get(
    "/verify-token",
    ({ _userId }) => {
      //もし空ならトークンが無効
      if (_userId === "") {
        return {
          success: false,
          message: "Token is invalid",
        };
      }

      //トークンが有効
      return {
        success: true,
        message: "Token is valid",
      };
    }
  );
