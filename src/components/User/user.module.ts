import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken from "../../Middlewares";
import { userWSInstance } from "../../ws";
import { userService } from "./user.service";

const db = new PrismaClient();

export const user = new Elysia({ prefix: "/user" })
  .use(userService)
  .put(
    "/sign-up",
    async ({ body: { username, password, inviteCode }, error }) => {
      //初めてのユーザーかどうか
      let flagFirstUser = false;
      //ユーザー数を取得して最初ならtrue
      const num = await db.user.count();
      if (num === 1) {
        flagFirstUser = true;
      }

      //最初のユーザーなら招待条件を確認しない
      if (!flagFirstUser) {
        //サーバーの設定を取得して招待関連の条件を確認
        const serverConfig = await db.serverConfig.findFirst();
        if (!serverConfig?.RegisterAvailable) {
          return error(400, {
            message: "Registration is disabled",
          });
        }
        if (serverConfig?.RegisterInviteOnly) {
          if (inviteCode === undefined) {
            return error(400, {
              message: "Invite code is invalid",
            });
          }
          //招待コードが有効か確認
          const Invite = await db.invitation.findUnique({
            where: { inviteCode: inviteCode },
          });
          //招待コードが無効な場合
          if (Invite === null) {
            return error(400, {
              message: "Invite code is invalid",
            });
          }
          //招待コードが期限切れの場合
          if (Invite.expireDate < new Date()) {
            return error(400, {
              message: "Invite code is invalid",
            });
          }
          //---------------------------------------
          //使用回数を加算
          await db.invitation.update({
            where: { inviteCode: inviteCode },
            data: {
              usedCount: Invite.usedCount + 1,
            },
          });
        }
      }

      const user = await db.user.findUnique({
        where: { name: username },
      });
      if (user) {
        return error(400, {
          message: "User already exists",
        });
      }

      //ソルト生成、パスワードのハッシュ化
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHashed = await Bun.password.hash(password + salt);
      //DBへユーザー情報を登録
      const createdUser = await db.user.create({
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

      //デフォルトで参加するチャンネルに参加させる
      const channelJoinOnDefault = await db.channelJoinOnDefault.findMany({});
      for (const channelIdJson of channelJoinOnDefault) {
        await db.channelJoin.create({
          data: {
            userId: createdUser.id,
            channelId: channelIdJson.channelId,
          },
        });
      }

      return {
        message: "User created",
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 4 }),
        inviteCode: t.Optional(t.String({ minLength: 1 })),
      }),
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
          message: "Internal error",
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

  .get(
    "/get-online",
    async () => {
      //オンラインユーザーIDを取得
      const onlineUserIds = Array.from(userWSInstance.keys());
      //重複を削除
      const uniqueOnlineUserIds = Array.from(new Set(onlineUserIds)).map(
        String,
      );

      return {
        message: "Fetched online user list",
        data: uniqueOnlineUserIds,
      };
    },
    {
      detail: {
        description: "オンラインユーザーを取得します",
        tags: ["User"],
      },
    },
  )
  .get(
    "/icon/:userId",
    async ({ params: { userId } }) => {
      //アイコン読み取り、存在確認して返す
      const iconFilePng = Bun.file(`./STORAGE/icon/${userId}.png`);
      if (await iconFilePng.exists()) {
        return iconFilePng;
      }
      const iconFileGif = Bun.file(`./STORAGE/icon/${userId}.gif`);
      if (await iconFileGif.exists()) {
        return iconFileGif;
      }
      const iconFileJpeg = Bun.file(`./STORAGE/icon/${userId}.jpeg`);
      if (await iconFileJpeg.exists()) {
        return iconFileJpeg;
      }

      //存在しない場合はデフォルトアイコンを返す
      return Bun.file("./STORAGE/icon/default.png");
    },
    {
      params: t.Object({
        userId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "ユーザーのアイコン画像を取得します",
        tags: ["User"],
      },
    },
  )
  .get(
    "/banner/:userId",
    async ({ params: { userId } }) => {
      //アイコン読み取り、存在確認して返す
      const bannerFilePng = Bun.file(`./STORAGE/banner/${userId}.png`);
      if (await bannerFilePng.exists()) {
        return bannerFilePng;
      }
      const bannerFileGif = Bun.file(`./STORAGE/banner/${userId}.gif`);
      if (await bannerFileGif.exists()) {
        return bannerFileGif;
      }
      const bannerFileJpeg = Bun.file(`./STORAGE/banner/${userId}.jpeg`);
      if (await bannerFileJpeg.exists()) {
        return bannerFileJpeg;
      }

      //存在しない場合はデフォルトアイコンを返す
      return error(404, "User banner not found");
    },
    {
      params: t.Object({
        userId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "ユーザーのバナー画像を取得します",
        tags: ["User"],
      },
    },
  )
  .post(
    "/change-icon",
    async ({ body: { icon }, _userId }) => {
      if (icon.size > 8 * 1024 * 1024) {
        return error(400, "File size is too large");
      }
      if (
        icon.type !== "image/png" &&
        icon.type !== "image/gif" &&
        icon.type !== "image/jpeg"
      ) {
        return error(400, "File type is invalid");
      }
      //拡張子取得
      const ext = icon.type.split("/")[1];

      //既存のアイコンを削除
      await unlink(`./STORAGE/icon/${_userId}.png`).catch(() => {});
      await unlink(`./STORAGE/icon/${_userId}.gif`).catch(() => {});
      await unlink(`./STORAGE/icon/${_userId}.jpeg`).catch(() => {});

      //アイコンを保存
      await Bun.write(`./STORAGE/icon/${_userId}.${ext}`, icon);
      return {
        message: "Icon changed",
      };
    },
    {
      body: t.Object({
        icon: t.File(),
      }),
      detail: {
        description: "ユーザーのアイコン画像を変更します",
        tags: ["User"],
      },
    },
  )
  .post(
    "/change-banner",
    async ({ _userId, body: { banner } }) => {
      if (banner.size > 10 * 1024 * 1024) {
        return error(400, "File size is too large");
      }
      if (
        banner.type !== "image/png" &&
        banner.type !== "image/gif" &&
        banner.type !== "image/jpeg"
      ) {
        return error(400, "File type is invalid");
      }
      //拡張子取得
      const ext = banner.type.split("/")[1];

      //既存のアイコンを削除
      await unlink(`./STORAGE/banner/${_userId}.png`).catch(() => {});
      await unlink(`./STORAGE/banner/${_userId}.gif`).catch(() => {});
      await unlink(`./STORAGE/banner/${_userId}.jpeg`).catch(() => {});

      //アイコンを保存
      await Bun.write(`./STORAGE/banner/${_userId}.${ext}`, banner);
      return {
        message: "Banner changed",
      };
    },
    {
      body: t.Object({
        banner: t.File(),
      }),
      detail: {
        description: "ユーザーのバナー画像を変更します",
        tags: ["User"],
      },
    },
  )
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
    async ({ body: { name, selfIntroduction }, _userId, server }) => {
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
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "user::ProfileUpdate",
          data: userUpdated,
        }),
      );

      return {
        message: "Profile updated",
        data: userUpdated,
      };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        selfIntroduction: t.Optional(t.String()),
      }),
      detail: {
        description: "プロフィールの更新",
        tags: ["User"],
      },
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
  .get(
    "/verify-token",
    ({ _userId, error }) => {
      //もし空ならトークンが無効
      if (_userId === "") {
        throw error(401, "Token is invalid");
      }

      //トークンが有効
      return {
        message: "Token is valid",
        data: {
          userId: _userId,
        },
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
            userId: t.String(),
          }),
        }),
        401: t.Literal("Token is invalid"),
      },
    },
  )
  .get(
    "/info/:id",
    async ({ params: { id } }) => {
      const user = await db.user.findFirst({
        where: {
          id: id,
        },
        include: {
          ChannelJoin: {
            select: {
              channelId: true,
            },
          },
          RoleLink: {
            select: {
              roleId: true,
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
        data: user,
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
    },
  )
  .get(
    "/list",
    async () => {
      const users = await db.user.findMany({
        include: {
          ChannelJoin: {
            select: {
              channelId: true,
            },
          },
          RoleLink: {
            select: {
              roleId: true,
            },
          },
        },
      });

      return {
        message: "User list",
        data: users,
      };
    },
    {
      detail: {
        description: "ユーザーの情報を一覧で取得します",
        tags: ["User"],
      },
    },
  );
