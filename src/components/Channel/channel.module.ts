import { type Message, PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";
import { userWSInstance } from "../../ws";

const db = new PrismaClient();

export const channel = new Elysia({ prefix: "/channel" })
  .use(CheckToken)
  .post(
    "/join",
    async ({ body: { channelId }, _userId, server }) => {

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

      //WS登録させる
      userWSInstance.get(_userId)?.subscribe(`channel::${channelId}`);

      return {
        message: "Channel joined",
        data: {
          channelId,
        }
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "チャンネルに参加します",
        tags: ["Channel"],
      },
      response: {
        200: t.Object({
          message: t.Literal("Channel joined"),
          data: t.Object({
            channelId: t.String()
          })
        }),
        400: t.Literal("Already joined"),
        404: t.Literal("Channel not found"),
      }
    }
  )
  .post(
    "/leave",
    async ({ body: { channelId }, _userId, server }) => {
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

      //WS登録を解除させる
      userWSInstance.get(_userId)?.unsubscribe(`channel::${channelId}`);

      return {
        message: "Channel left",
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "チャンネルから退出します",
        tags: ["Channel"],
      },
      response: {
        200: t.Object({
          message: t.Literal("Channel left"),
        }),
        400: t.Literal("You are not joined this channel"),
      }
    }
  )
  .get(
    "/list",
    async ({ server }) => {
      const channelList = await db.channel.findMany();

      //DEBUG :: 全体に通知
      server?.publish("GLOBAL", JSON.stringify({
        signal: "channel::Listとるテスト",
        data: "asdf"
      }));
      console.log("/channel/list :: 送信したつもり");

      return {
        message: "Channel list ready",
        data: channelList
      };
    },
    {
      detail: {
        description: "チャンネル一覧を取得します",
        tags: ["Channel"],
      },
    }
  )
  .post(
    "/get-history/:channelId",
    async ({ params: { channelId }, body }) => {
      //パラメータ指定の取得
      const { messageIdFrom, fetchDirection, fetchLength, messageTimeFrom } = body || {};

      let messageDataFrom: Message | null = null;
      //基準位置になるメッセージIdが指定されているなら
      if (messageIdFrom !== undefined) {
        //取得、格納
        messageDataFrom = await db.message.findUnique({
          where: {
            id: messageIdFrom
          }
        });
        //無ければエラー
        if (!messageDataFrom) {
          return error(404, "Message cursor position not found");
        }
      }
      //基準位置になるメッセージ時間が指定されているなら
      if (messageTimeFrom !== undefined) {
        //取得、格納
        messageDataFrom = await db.message.findFirst({
          where: {
            createdAt: new Date(messageTimeFrom)
          }
        });
        //無ければエラー
        if (!messageDataFrom)
          return error(404, "Message cursor position not found");

      }

      //基準のメッセージIdがあるなら時間を取得、取得設定として設定
      let optionDate: {createdAt: {lte: Date} | {gte: Date}} | null = null;
      if (messageDataFrom !== null) {
        //取得時間方向に合わせて設定を指定
        if (fetchDirection === 'older') {
          //古い方向に取得する場合
          optionDate = {
            createdAt: {
              lte: new Date(messageDataFrom.createdAt),
            }
          };
        } else {
          //新しい方向に取得する場合
          optionDate = {
            createdAt: {
              gte: new Date(messageDataFrom.createdAt),
            }
          };
        }
      }

      //履歴を取得する
      const history = await db.message.findMany({
        where: {
          channelId: channelId,
          ...optionDate,
        },
        take: fetchLength,
        orderBy: { createdAt: 'desc' }
      });

      return {
        message: "History fetched",
        data: history
      };
    },
    {
      params: t.Object({
        channelId: t.String()
      }),
      body: t.Optional(
        t.Object({
          messageIdFrom: t.Optional(t.String()),
          messageTimeFrom: t.Optional(t.String()),
          fetchLength: t.Number({ default: 30, maximum: 30 }),
          fetchDirection: t.Union([t.Literal('older'), t.Literal('newer')], {default: 'older'})
        })
      ),
      detail: {
        description: "チャンネルのメッセージ履歴を取得します",
        tags: ["Channel"],
      },
    }
  )

  .use(checkRoleTerm)

  .post(
    "/update",
    async ({ body: {name, description, isArchived, channelId}, server }) => {
      //適用するデータ群のJSON
      const updatingValues: {
        name?: string,
        description?: string,
        isArchived?: boolean
      } = {};

        //渡されたデータを調べて適用するデータを格納
      if (name) updatingValues.name = name;
      if (description) updatingValues.description = description;
      if (isArchived !== undefined) updatingValues.isArchived = isArchived;

      //チャンネルデータを更新する
      const channelDataUpdated = await db.channel.update({
        where: {
          id: channelId
        },
        data: {
          ...updatingValues
        }
      });

      //WSで通知
      server?.publish("GLOBAL", JSON.stringify({
        signal: "channel::UpdateChannel",
        data: channelDataUpdated
      }));

      return {
        message: "Channel updated",
        data: channelDataUpdated
      }

    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        isArchived: t.Optional(t.Boolean())
      }),
      detail: {
        description: "チャンネル情報を更新します",
        tags: ["Channel"],
      },
      checkRoleTerm: "manageChannel",
    }
  )
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
      detail: {
        description: "チャンネルを作成します",
        tags: ["Channel"],
      },
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

      //メッセージデータを削除
      await db.message.deleteMany({
        where: {
          channelId,
        },
      });

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
      detail: {
        description: "チャンネルを削除します",
        tags: ["Channel"],
      },
      checkRoleTerm: "manageChannel",
    },
  );
