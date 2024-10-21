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
    "/new",
    async ({ _userId }) => {
      // ユーザーが参加しているチャンネルを取得
      const userChannelJoined = await db.channelJoin.findMany({
        where: {
          userId: _userId,
        },
        select: {
          channelId: true,
        },
      });
      //チャンネルIdのJSONを配列化
      const channelIds = userChannelJoined.map((channel) => channel.channelId);
      //チャンネルがない場合は空JSONを返す
      if (channelIds.length === 0) {
        return {
          message: "Fetched news",
          data: {},
        };
      }

      //ユーザーの既読時間を取得
      const messageReadTime = await db.messageReadTime.findMany({
        where: {
          userId: _userId,
          channelId: {
            in: channelIds,
          },
        },
        select: {
          channelId: true,
          readTime: true,
        },
      });

      //チャンネルごとの新着メッセージがあるかどうかを格納するJSON
      const JSONnews: { [key: string]: boolean } = {};

      //チャンネルごとの最新メッセージを取得、比較
      for (const channelId of channelIds) {
        //指定のチャンネルIdの最新メッセージを取得
        const newest = await db.message.findFirst({
          where: {
            channelId: {
              in: channelIds,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });
        //存在するなら
        if (newest) {
          //自分の既読時間を取得
          const readTimeData = messageReadTime.find(
            (data) => data.channelId === channelId,
          );
          //存在するなら比較してBooleanを返す、ないならfalse
          if (readTimeData) {
            JSONnews[channelId] =
              newest.createdAt.valueOf() > readTimeData?.readTime.valueOf();
          } else {
            JSONnews[channelId] = false;
          }
        } else {
          //存在しないならfalse
          JSONnews[channelId] = false;
        }
      }

      return {
        message: "Fetched news",
        data: JSONnews,
      };
    },
    {
      detail: {
        description: "チャンネルごとの新着メッセージがあるかどうかを取得します",
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
      },
    },
  )
  .post(
    "/read-time/update",
    async ({ _userId, body: { channelId, readTime }, server }) => {
      //既読時間を取得して更新する必要があるか調べる
      const readTimeNow = await db.messageReadTime.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId: _userId,
          },
        },
      });
      if (
        readTimeNow !== null &&
        readTimeNow.readTime.valueOf() > readTime.valueOf()
      ) {
        throw error(400, "Read time is already newer");
      }

      const readTimeUpdated = await db.messageReadTime.upsert({
        where: {
          channelId_userId: {
            channelId,
            userId: _userId,
          },
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

      //WSで通知
      server?.publish(
        `user::${_userId}`,
        JSON.stringify({
          signal: "message::ReadTimeUpdated",
          data: readTimeUpdated,
        }),
      );

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
      },
    },
  )
  .use(urlPreviewControl)
  .post(
    "/send",
    async ({ body: { channelId, message }, _userId, server }) => {
      //メッセージが空白か改行しか含まれていないならエラー
      const spaceCount =
        (message.match(/ /g) || "").length +
        (message.match(/　/g) || "").length +
        (message.match(/\n/g) || "").length;
      if (spaceCount === message.length) throw error(400, "Message is empty");

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
