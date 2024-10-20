import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { urlPreviewControl } from "../../Middlewares";

const db = new PrismaClient();

export const message = new Elysia({ prefix: "/message" })
  .use(CheckToken)
  .get(
    "/get/:messageId",
    async ({ params: { messageId }, _userId }) => {
      const messageData = await db.message.findUnique({
        where: {
          id: messageId,
        },
      });
      //メッセージが見つからなければエラー
      if (messageData === null) {
        return error(404, "Message not found");
      }

      //チャンネルの閲覧制限があるか確認
      const roleViewable = await db.channelViewableRole.findMany({
        where: {
          channelId: messageData.channelId,
        },
        select: {
          roleId: true,
        },
      });

      // 閲覧制限があるならユーザーが条件に入るか調べる
      if (roleViewable.length > 0) {
        // チャンネルに参加しているか調べる
        const channelJoined = await db.channelJoin.findUnique({
          where: {
            userId_channelId: {
              userId: _userId,
              channelId: messageData.channelId,
            },
          },
        });

        // チャンネルに参加していないならロールで調べる
        if (!channelJoined) {
          const hasViewableRole = await db.roleLink.findFirst({
            where: {
              userId: _userId,
              roleId: { in: roleViewable.map((role) => role.roleId) },
            },
          });

          // ロールを持っていれば閲覧可能
          if (hasViewableRole) {
            return { message: "Fetched message", data: messageData };
          }

          // サーバー管理者の場合は閲覧可能
          const userAdminRole = await db.roleLink.findFirst({
            where: {
              userId: _userId,
              role: { manageServer: true },
            },
          });

          if (userAdminRole) {
            return { message: "Fetched message", data: messageData };
          }
        } else {
          // チャンネルに参加している場合はそのまま返す
          return { message: "Fetched message", data: messageData };
        }
      } else {
        // 閲覧制限がない場合はそのまま返す
        return { message: "Fetched message", data: messageData };
      }

      return error(404, "Message not found");
    },
    {
      params: t.Object({
        messageId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "メッセージを単体で取得します",
        tags: ["Message"],
      },
    },
  )
  .get(
    "/read-time/get",
    async ({ _userId }) => {
      const readTime = await db.messageReadTime.findFirst({
        where: {
          userId: _userId,
        },
      });

      return {
        message: "Fetched read time",
        data: readTime,
      };
    },
    {
      detail: {
        description: "既読時間の設定を取得します",
        tags: ["Message"],
      }
    }
  )
  .post(
    "/read-time/update",
    async ({ _userId, body: {channelId, readTime} }) => {
      const readTimeUpdated = await db.messageReadTime.upsert({
        where: {
          channelId_userId: {
            channelId,
            userId: _userId,
          }
        },
        create: {
          readTime,
          channelId,
          userId: _userId,
        },
        update: {
          readTime,
        },
      });

      return {
        message: "Updated read time",
        data: readTimeUpdated,
      };
    },
    {
      body: t.Object({
        readTime: t.Date(),
        channelId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "既読時間の設定を更新します",
        tags: ["Message"],
      }
    }
  )
  .use(urlPreviewControl)
  .post(
    "/send",
    async ({ body: { channelId, message }, _userId, server }) => {
      //チャンネル参加情報を取得
      const channelJoined = await db.channelJoin.findFirst({
        where: {
          userId: _userId,
          channelId,
        },
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
        },
      });

      //WSで通知
      server?.publish(
        `channel::${channelId}`,
        JSON.stringify({
          signal: "message::SendMessage",
          data: messageSaved,
        }),
      );

      return {
        message: "Message sent",
        data: messageSaved,
      };
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
    },
  );
