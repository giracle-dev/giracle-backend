import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";
import { unlink } from "node:fs/promises";

const db = new PrismaClient();

export const server = new Elysia({ prefix: "/server" })
  .get(
    "/config",
    async () => {
      //サーバーの情報取得
      const config = await db.serverConfig.findFirst();
      //最初のユーザーになるかどうか
      const firstUser = await db.user.findFirst({
        skip: 1,
      });
      const isFirstUser = firstUser === null;

      return {
        message: "Server config fetched",
        data: { ...config, isFirstUser, id: undefined }, // idは返さない,
      };
    },
    {
      detail: {
        description: "サーバーの設定を取得します",
        tags: ["Server"],
      },
    },
  )
  .get(
    "/banner",
    async () => {
      //バナー読み取り、存在確認して返す
      const serverFilePng = Bun.file("./STORAGE/banner/SERVER.png");
      if (await serverFilePng.exists()) {
        return serverFilePng;
      }
      const serverFileGif = Bun.file("./STORAGE/banner/SERVER.gif");
      if (await serverFileGif.exists()) {
        return serverFileGif;
      }
      const bannerFileJpeg = Bun.file("./STORAGE/banner/SERVER.jpeg");
      if (await bannerFileJpeg.exists()) {
        return bannerFileJpeg;
      }

      //存在しない場合はデフォルトアイコンを返す
      return error(404, "Server banner not found");
    },
    {
      detail: {
        description: "サーバーのアイコン画像を取得します",
        tags: ["Server"],
      },
    },
  )

  .use(CheckToken)
  .use(checkRoleTerm)
  .get(
    "/get-invite",
    async () => {
      const invites = await db.invitation.findMany();

      return {
        message: "Server invites fetched",
        data: invites,
      };
    },
    {
      detail: {
        description: "サーバーの招待コード情報を取得します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    },
  )
  .put(
    "/create-invite",
    async ({ body: { inviteCode, expireDate }, _userId }) => {
      const newInvite = await db.invitation.create({
        data: {
          inviteCode,
          createdUserId: _userId,
          expireDate,
        },
      });

      return {
        message: "Server invite created",
        data: newInvite,
      };
    },
    {
      body: t.Object({
        inviteCode: t.String({ minLength: 1 }),
        expireDate: t.Optional(t.Date()),
      }),
      detail: {
        description: "サーバーの招待コードを作成します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    },
  )
  .delete(
    "/delete-invite",
    async ({ body: { inviteId } }) => {
      await db.invitation.delete({
        where: {
          id: inviteId,
        },
      });

      return {
        message: "Server invite deleted",
        data: {
          id: inviteId,
        },
      };
    },
    {
      body: t.Object({
        inviteId: t.Number(),
      }),
      detail: {
        description: "サーバーの招待コードを作成します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    },
  )
  .post(
    "/change-info",
    async ({ body: { name, introduction }, server }) => {
      await db.serverConfig.updateMany({
        data: {
          name,
          introduction,
        },
      });

      //ここでデータ取得
      const serverinfo = await db.serverConfig.findFirst();
      if (serverinfo === null) return error(500, "Server config not found");

      //WSで全体へ通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "server::ConfigUpdate",
          data: { ...serverinfo, id: undefined },
        }),
      );

      return {
        message: "Server info updated",
        data: { ...serverinfo, id: undefined }, // idは返さない
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        introduction: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "サーバーの基本情報を変更します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    },
  )
  .post(
    "/change-config",
    async ({
      body: { RegisterAvailable, RegisterInviteOnly, MessageMaxLength },
      server,
    }) => {
      await db.serverConfig.updateMany({
        data: {
          RegisterAvailable,
          RegisterInviteOnly,
          MessageMaxLength,
        },
      });

      //ここでデータ取得
      const serverinfo = await db.serverConfig.findFirst();
      if (serverinfo === null) return error(500, "Server config not found");

      //WSで全体へ通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "server::ConfigUpdate",
          data: { ...serverinfo, id: undefined }, // idは返さない
        }),
      );

      return {
        message: "Server config updated",
        data: { ...serverinfo, id: undefined }, // idは返さない
      };
    },
    {
      body: t.Object({
        RegisterAvailable: t.Optional(t.Boolean()),
        RegisterInviteOnly: t.Optional(t.Boolean()),
        MessageMaxLength: t.Optional(t.Number()),
      }),
      detail: {
        description: "サーバーの設定を変更します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    },
  )
  .post(
    "/change-banner",
    async ({ body: { banner } }) => {
      if (banner.size > 15 * 1024 * 1024) {
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
      await unlink("./STORAGE/banner/SERVER.png").catch(() => {});
      await unlink("./STORAGE/banner/SERVER.gif").catch(() => {});
      await unlink("./STORAGE/banner/SERVER.jpeg").catch(() => {});

      //アイコンを保存
      Bun.write(`./STORAGE/banner/SERVER.${ext}`, banner);
      return {
        message: "Server banner changed",
      };
    },
    {
      body: t.Object({
        banner: t.File(),
      }),
      detail: {
        description: "サーバーのバナー画像を変更します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    }
  );
