import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";

const db = new PrismaClient();

export const channel = new Elysia({ prefix: "/channel" })
  .use(CheckToken)
  .post(
    "/join",
    async ({ body: { channelId }, _userId }) => {
      
      //チャンネル参加データが存在するか確認
      const channelJoined = await db.channelJoin.findFirst({
        where: {
          userId: _userId,
          channelId,
        },
      });
      //既に参加している
      if (channelJoined !== null) {
        throw error(400, "Already joined");
      }

      //チャンネルが存在するか確認
      const channelData = await db.channel.findUnique({
        where: {
          id: channelId,
        },
      });
      //チャンネルが存在しない
      if (channelData === null) {
        throw error(404, "Channel not found");
      }

      await db.channelJoin.create({
        data: {
          userId: _userId,
          channelId,
        },
      });

      return {
        message: "Channel joined",
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
      }),
    }
  )
  .post(
    "/leave",
    async ({ body: { channelId }, _userId }) => {
      //チャンネル参加データが存在するか確認
      const channelJoinData = await db.channelJoin.findFirst({
        where: {
          userId: _userId,
          channelId
        },
      });
      if (channelJoinData === null) {
        throw error(400, "You are not joined this channel");
      }

      await db.channelJoin.deleteMany({
        where: {
          userId: _userId,
          channelId,
        },
      });

      return {
        message: "Channel left",
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
      }),
    }
  )
  .get(
    "/list",
    async ({ _userId }) => {
      const channelList = await db.channelJoin.findMany();

      return {
        message: "Channel list ready",
        data: channelList
      };
    }
  )

  .use(checkRoleTerm)
  .put(
    "/create",
    async ({ body: { channelName, description = "" }, _userId }) => {
      const newChannel = await db.channel.create({
        data: {
          name: channelName,
          description: description,
          user: {
            connect: {
              id: _userId,
            },
          },
        },
      });

      return {
        success: true,
        message: "Channel created",
        data: {
          channelId: newChannel.id,
        },
      };
    },
    {
      body: t.Object({
        channelName: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
      }),
      checkRoleTerm: "manageChannel",
    },
  )
  .delete(
    "/delete",
    async ({ body: { channelId }, _userId }) => {
      const channel = await db.channel.findUnique({
        where: {
          id: channelId,
        },
      });

      //チャンネルが存在しない
      if (channel === null) {
        return {
          success: false,
          message: "Channel not found",
        };
      }

      //チャンネルの作成者でない
      if (channel.createdUserId !== _userId) {
        return {
          success: false,
          message: "You are not the creator of this channel",
        };
      }

      //チャンネル参加データを削除
      await db.channelJoin.deleteMany({
        where: {
          channelId,
        },
      });

      await db.channel.delete({
        where: {
          id: channelId,
        },
      });

      return {
        success: true,
        message: "Channel deleted",
      };
    },
    {
      body: t.Object({
        channelId: t.String(),
      }),
      checkRoleTerm: "manageChannel",
    },
  );
