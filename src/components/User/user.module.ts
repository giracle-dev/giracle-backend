import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken from "../../Middlewares";
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
          message: "User already exists",
        });
      }

      //初めてのユーザーかどうか
      let flagFirstUser = false;
      //ユーザー数を取得して最初ならtrue
      const num = await db.user.count();
      if (num === 1) {
        flagFirstUser = true;
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
          RoleLink: {
            create: {
              roleId: flagFirstUser ? "HOST" : "MEMBER",
            },
          },
        },
      });

      return {
        message: "User created",
      };
    },
    {
      body: "signIn",
      detail: {
        description: "ユーザーの新規登録",
        tags: ["User"],
      },
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
          message: "Auth info is incorrect",
        });
      }
      //パスワードが設定されていない場合
      if (!user.password) {
        return error(400, {
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
      token.sameSite = "lax";
      token.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); //15日間有効

      return {
        message: `Signed in as ${username}`,
        data: {
          userId: user.id,
        },
      };
    },
    {
      body: "signIn",
      cookie: t.Cookie({ token: t.Optional(t.String()) }),
      detail: {
        description: "ユーザーのサインイン",
        tags: ["User"],
      },
    },
  )

  .use(CheckToken)

  .post(
    "/change-password",
    async ({ error, body: { currentPassword, newPassword }, _userId }) => {
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
          message: "Current password is incorrect",
        });
      }

      //新しいパスワードをハッシュ化してDBに保存
      await db.password.update({
        where: {
          userId: userdata.id,
        },
        data: {
          password: await Bun.password.hash(
            newPassword + userdata.password.salt,
          ),
        },
      });

      return {
        message: "Password changed",
      };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 4 }),
        newPassword: t.String({ minLength: 4 }),
      }),
      cookie: t.Cookie({ token: t.String() }),
      detail: {
        description: "パスワードの変更",
        tags: ["User"],
      },
    },
  )
  .post(
    "/profile-update",
    async ({ body: {name, selfIntroduction}, _userId, server }) => {
      //ユーザー情報取得
      const user = await db.user.findUnique({
        where: {
          id: _userId,
        },
      });
      //ユーザーが存在しない場合
      if (!user) {
        return error(404, "User not found");
      }

      // 更新データの準備
      const updatingValue: { name?: string; selfIntroduction?: string } = {};
      if (name !== undefined) {
        updatingValue.name = name;
      }
      if (selfIntroduction !== undefined) {
        updatingValue.selfIntroduction = selfIntroduction;
      }

      //データ更新
      const userUpdated = await db.user.update({
        where: {
          id: user.id,
        },
        data: updatingValue,
      });
    
      //WSで全体へ通知
      server?.publish("GLOBAL", JSON.stringify({
        signal: "user::ProfileUpdate",
        data: userUpdated,
      }));

      return {
        message: "Profile updated",
        data: userUpdated
      };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        selfIntroduction: t.Optional(t.String()),
      }),
      detail: {
        description: "プロフィールの更新",
        tags: ["User"],
      },
    }
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
        message: "Signed out",
      };
    },
    {
      cookie: t.Cookie({ token: t.String() }),
      detail: {
        description: "ユーザーのサインアウト",
        tags: ["User"],
      },
    },
  )
  .get("/verify-token", ({ _userId, error }) => {
    //もし空ならトークンが無効
    if (_userId === "") {
      throw error(401, "Token is invalid");
    }

    //トークンが有効
    return {
      message: "Token is valid",
      data: {
        userId: _userId
      }
    };
  },
  {
    detail: {
      description: "トークンの検証",
      tags: ["User"],
    },
    response: {
      200: t.Object({
        message: t.Literal("Token is valid"),
        data: t.Object({
          userId: t.String()
        })
      }),
      401: t.Literal("Token is invalid")
    }
  }
  )
  .get(
    "/info/:id",
    async ({ params: { id } }) => {
      const user = await db.user.findFirst({
        where: {
          id: id,
        },
        include: {
          RoleLink: {
            select: {
              roleId: true,
              roleLinkedAt: true,
              role: {
                select: {
                  name: true,
                },
              }
            },
          },
        },
      });
      //ユーザーが存在しない場合
      if (!user) {
        return error(404, "User not found");
      }

      return {
        message: "User info",
        data: user
      };
    },
    {
      params: t.Object({
        id: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "ユーザー情報を取得します",
        tags: ["User"],
      },
    }
  )
