import Elysia, { error, t } from "elysia";
import CheckToken, { urlPreviewControl } from "../../Middlewares";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export const message = new Elysia({ prefix: "/message" })
  .use(CheckToken)
  .use(urlPreviewControl)
  .post(
    "/send",
    async ({ body: { channelId, message }, _userId, server }) => {
      //チャンネル参加情報を取得
      const channelJoined = await db.channelJoin.findFirst({
        where: {
          userId: _userId,
          channelId,
        }
      });
      //チャンネルに参加していない
      if (channelJoined === null) {
        throw error(400, "You are not joined this channel");
      }

      const messageSaved = await db.message.create({
        data: {
          channelId,
          userId: _userId,
          content: message,
        }
      })

      //WSで通知
      server?.publish(`channel::${channelId}`, JSON.stringify({
        signal: "message::SendMessage",
        data: messageSaved
      }));

      return {
        message: "Message sent",
        data: {
          messageSaved,
        }
      }
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
        message: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "メッセージを送信します",
        tags: ["Message"],
      },
      bindUrlPreview: true,
    }
  )