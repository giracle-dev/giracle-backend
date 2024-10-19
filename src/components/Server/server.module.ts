import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";

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
    "/update-invite",
    async ({ body: { inviteId, isActive } }) => {
      const inviteDataNow = await db.invitation.update({
        where: {
          id: inviteId,
        },
        data: {
          isActive,
        },
      });

      return {
        message: "Server invite updated",
        data: inviteDataNow,
      };
    },
    {
      body: t.Object({
        inviteId: t.Number(),
        isActive: t.Boolean(),
      }),
      detail: {
        description: "サーバーの招待コードの状態を更新します",
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
  );
