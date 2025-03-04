import {type Message, PrismaClient} from "@prisma/client";
import Elysia, {error, t} from "elysia";
import CheckToken, {checkRoleTerm} from "../../Middlewares";
import CheckChannelVisibility from "../../Utils/CheckChannelVisitiblity";
import GetUserViewableChannel from "../../Utils/GetUserViewableChannel";
import SendSystemMessage from "../../Utils/SendSystemMessage";
import {WSSubscribe, WSUnsubscribe} from "../../ws";
import CalculateReactionTotal from "../../Utils/CalculateReactionTotal";

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
      //チャンネルを見られないようなユーザーだと存在しないとしてエラーを出す
      if (!(await CheckChannelVisibility(channelId, _userId))) {
        throw error(404, "Channel not found")
      }

      await db.channelJoin.create({
        data: {
          userId: _userId,
          channelId,
        },
      });

      //WS登録させる
      //userWSInstance.get(_userId)?.subscribe(`channel::${channelId}`);
      WSSubscribe(_userId, `channel::${channelId}`);
      //システムメッセージを送信
      SendSystemMessage(channelId, _userId, "CHANNEL_JOIN", server);

      return {
        message: "Channel joined",
        data: {
          channelId,
        },
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
            channelId: t.String(),
          }),
        }),
        400: t.Literal("Already joined"),
        404: t.Literal("Channel not found"),
      },
    },
  )
  .post(
    "/leave",
    async ({ body: { channelId }, _userId, server }) => {
      //チャンネル参加データが存在するか確認
      const channelJoinData = await db.channelJoin.findFirst({
        where: {
          userId: _userId,
          channelId,
        },
      });
      if (channelJoinData === null) {
        throw error(400, "You are not joined this channel");
      }

      //既読時間データを削除
      await db.messageReadTime
        .delete({
          where: {
            channelId_userId: {
              channelId,
              userId: _userId,
            },
          },
        })
        .catch(() => {});
      //チャンネル参加データを削除
      await db.channelJoin.deleteMany({
        where: {
          userId: _userId,
          channelId,
        },
      });

      //WS登録を解除させる
      //userWSInstance.get(_userId)?.unsubscribe(`channel::${channelId}`);
      WSUnsubscribe(_userId, `channel::${channelId}`);
      //システムメッセージを送信
      SendSystemMessage(channelId, _userId, "CHANNEL_LEFT", server);

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
      },
    },
  )
  .get(
    "/get-info/:channelId",
    async ({ params: { channelId }, _userId }) => {
      //チャンネルを見られないようなユーザーだと存在しないとしてエラーを出す
      if (!(await CheckChannelVisibility(channelId, _userId))) {
        throw error(404, "Channel not found")
      }

      const channelData = await db.channel.findUnique({
        where: {
          id: channelId,
        },
        include: {
          ChannelViewableRole: {
            select: {
              roleId: true
            }
          },
        }
      });

      if (channelData === null) {
        return error(404, "Channel not found");
      }

      return {
        message: "Channel info ready",
        data: channelData,
      };
    },
    {
      params: t.Object({
        channelId: t.String(),
      }),
      detail: {
        description: "チャンネル単体の情報を取得します",
        tags: ["Channel"],
      },
    },
  )
  .get(
    "/list",
    async ({ _userId }) => {
      //ロール閲覧制限のないチャンネルリストから取得
      const channelList = await db.channel.findMany({
        where: {
          ChannelViewableRole: {
            none: {},
          },
        },
      });

      //ユーザーのロールを取得
      const user = await db.user.findUnique({
        where: {
          id: _userId,
        },
        include: {
          RoleLink: true,
        },
      });
      if (!user) {
        throw error(500, "Internal Server Error");
      }
      //指定のロールでしか閲覧できない、また他条件でのチャンネルを取得
      const roleIds = user.RoleLink.map((roleLink) => roleLink.roleId);
      const channelsLimited = await db.channel.findMany({
        where: {
          OR: [
            {
              //閲覧制限があり、自分がそのロールに所属している
              ChannelViewableRole: {
                some: {
                  roleId: {
                    in: roleIds,
                  },
                },
              },
            },
            {
              //自分が作成した
              createdUserId: _userId,
            },
            {
              //自分が参加している
              ChannelJoin: {
                some: {
                  userId: _userId,
                },
              },
            },
          ],
        },
      });

      //重複を取り除く
      const mergedChannels = [...channelList, ...channelsLimited];
      const uniqueChannels = Array.from(
        new Set(mergedChannels.map((channel) => JSON.stringify(channel))),
      ).map((channel) => JSON.parse(channel));

      return {
        message: "Channel list ready",
        data: uniqueChannels,
      };
    },
    {
      detail: {
        description: "チャンネル一覧を取得します",
        tags: ["Channel"],
      },
    },
  )
  .post(
    "/get-history/:channelId",
    async ({ params: { channelId }, body, _userId }) => {
      //パラメータ指定の取得
      const { messageIdFrom, fetchDirection, fetchLength, messageTimeFrom } =
        body || {};

      //チャンネルへのアクセス権限があるか調べる
      if (!(await CheckChannelVisibility(channelId, _userId))) {
        return error(403, "You don't have permission to access this channel");
      }

      //基準位置に時間指定があるなら有効か確認
      if (messageTimeFrom !== undefined) {
        if (Number.isNaN(Date.parse(messageTimeFrom))) {
          return error(400, "Invalid time format");
        }
      }

      let messageDataFrom: Message | null = null;
      //基準位置になるメッセージIdが指定されているなら
      if (messageIdFrom !== undefined) {
        //取得、格納
        messageDataFrom = await db.message.findUnique({
          where: {
            id: messageIdFrom,
          },
        });
        //無ければエラー
        if (!messageDataFrom) {
          return error(404, "Message cursor position not found");
        }
      }

      //基準のメッセージIdか時間指定があるなら時間を取得、取得設定として設定
      let optionDate: { createdAt: { lte: Date } | { gte: Date } } | null =
        null;
      if (messageDataFrom !== null) {
        //基準のメッセージIdによる取得データがあるなら
        //取得時間方向に合わせて設定を指定
        if (fetchDirection === "older") {
          //古い方向に取得する場合
          optionDate = {
            createdAt: {
              lte: messageDataFrom.createdAt,
            },
          };
        } else {
          //新しい方向に取得する場合
          //指定時間以降の最初のメッセージを取得
          const messageTakingFrom = await db.message.findMany({
            where: {
              channelId: channelId,
              createdAt: {
                gte: messageDataFrom.createdAt,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
            take: fetchLength,
          });
          //指定時間以降のメッセージの時間より前のメッセージを取得するように設定
          optionDate = {
            createdAt: {
              lte: messageTakingFrom[messageTakingFrom.length - 1].createdAt,
              gte: messageDataFrom.createdAt,
            },
          };
        }
      } else if (messageTimeFrom !== undefined) {
        //メッセージId指定がない場合、時間指定を使う
        //取得時間方向に合わせて設定を指定
        if (fetchDirection === "older") {
          //古い方向に取得する場合
          optionDate = {
            createdAt: {
              lte: new Date(messageTimeFrom),
            },
          };
        } else {
          //新しい方向に取得する場合
          //指定時間以降の最初のメッセージを取得
          const messageTakingFrom = await db.message.findMany({
            where: {
              channelId: channelId,
              createdAt: {
                gte: new Date(messageTimeFrom),
              },
            },
            orderBy: {
              createdAt: "asc",
            },
            take: fetchLength,
          });
          //指定時間以降のメッセージの時間より前のメッセージを取得するように設定
          optionDate = {
            createdAt: {
              lte:
                messageTakingFrom[messageTakingFrom.length - 1]?.createdAt ||
                undefined,
              gte: new Date(messageTimeFrom),
            },
          };
        }
      }

      //履歴を取得する
      const history = await db.message.findMany({
        where: {
          channelId: channelId,
          ...optionDate,
        },
        include: {
          MessageUrlPreview: true,
          MessageFileAttached: true,
        },
        take: fetchLength,
        orderBy: { createdAt: "desc" },
      });

      //履歴の最新まで取ったかどうかを判別するために最初のメッセージを取得
      const firstMessageOfChannel = await db.message.findFirst({
        where: {
          channelId: channelId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      //取得した履歴が最新まで取得したか、または最初まで取得したかを判別
      let atEnd = false;
      let atTop = false;
      //取得方向によって判別方法が異なる
      if (fetchDirection === "newer") {
        //取得した履歴がある場合
        if (history[0] !== undefined) {
          atTop = firstMessageOfChannel?.id === history[0].id;
        } else {
          //取得した履歴がない場合、最初まで取得したと判定
          atTop = true;
        }
        atEnd = history.length < (fetchLength || 30);
      } else {
        //取得した履歴がある場合
        if (history[0] !== undefined) {
          atEnd = firstMessageOfChannel?.id === history[0].id;
        } else {
          //取得した履歴がない場合、最初まで取得したと判定
          atEnd = true;
        }
        atTop = history.length < (fetchLength || 30);
      }

      //最後にメッセージごとにリアクションの合計数をそれぞれ格納する
      for (const index in history) {
        const emojiTotalJson = await CalculateReactionTotal(history[index].id, _userId);

        //結果をこのメッセージ部分に格納する
        history[index] = {
          ...history[index],
          // @ts-ignore - reactionSummaryの追加
          reactionSummary: emojiTotalJson
        };
      }

      return {
        message: "History fetched",
        data: {
          history,
          atTop,
          atEnd,
        },
      };
    },
    {
      params: t.Object({
        channelId: t.String(),
      }),
      body: t.Optional(
        t.Object({
          messageIdFrom: t.Optional(t.String()),
          messageTimeFrom: t.Optional(t.String()),
          fetchLength: t.Number({ default: 30, maximum: 30 }),
          fetchDirection: t.Union([t.Literal("older"), t.Literal("newer")], {
            default: "older",
          }),
        }),
      ),
      detail: {
        description: "チャンネルのメッセージ履歴を取得します",
        tags: ["Channel"],
      },
    },
  )
  .get(
    "/search",
    async ({ query: { query }, _userId }) => {
      //閲覧できるチャンネルをId配列で取得
      const channelViewable = await GetUserViewableChannel(_userId);
      const channelIdsViewable = channelViewable.map((c) => c.id);

      //チャンネル検索
      const channelInfos = await db.channel.findMany({
        where: {
          name: {
            contains: query,
          },
          id: {
            in: channelIdsViewable,
          },
        },
      });

      return {
        message: "Searched channels",
        data: channelInfos,
      };
    },
    {
      query: t.Object({
        query: t.String(),
      }),
      detail: {
        description: "チャンネル情報を検索します",
        tags: ["Channel"],
      },
    },
  )

  .use(checkRoleTerm)

  .post(
    "/update",
    async ({ body: { name, description, isArchived, channelId, viewableRole }, server }) => {
      //適用するデータ群のJSON
      const updatingValues: {
        name?: string;
        description?: string;
        isArchived?: boolean;
      } = {};

      //渡されたデータを調べて適用するデータを格納
      if (name !== undefined && name !== "") updatingValues.name = name;
      if (description !== undefined) updatingValues.description = description;
      if (isArchived !== undefined) updatingValues.isArchived = isArchived;

      //チャンネルデータを更新する
      await db.channel.update({
        where: {
          id: channelId,
        },
        data: {
          ...updatingValues,
        },
      });

      //チャンネル閲覧ロールを更新
      if (viewableRole !== undefined) {
        // 既存のroleIdを取得
        const existingRoles = await db.channelViewableRole.findMany({
          where: {
            channelId: channelId,
          },
          select: {
            roleId: true,
          },
        });

        // 既存のroleIdをセットに変換
        //const existingRoleIds = new Set(existingRoles.map(role => role.roleId));
        const _existingRoleIds = existingRoles.map(role => role.roleId);
        const existingRoleIds = new Set(_existingRoleIds);

        // 新しいroleIdをフィルタリング
        const newRoleIds = viewableRole.filter(roleId => !existingRoleIds.has(roleId));

        //現在の閲覧可能roleIdを削除
        await db.channelViewableRole.deleteMany({
          where: {
            channelId,
          },
        });

        // 新しいroleIdを挿入
        if (newRoleIds.length > 0) {
          await db.channel.update({
            where: {
              id: channelId,
            },
            data: {
              ChannelViewableRole: {
                createMany: {
                  data: newRoleIds.map(roleId => ({
                    roleId,
                  })),
                },
              },
            },
          });
        }
      }

      //更新後のデータを取得
      const channelDataUpdated = await db.channel.findUnique({
        where: {
          id: channelId,
        },
        include: {
          ChannelViewableRole: {
            select: {
              roleId: true
            }
          },
        }
      });

        //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "channel::UpdateChannel",
          data: channelDataUpdated,
        }),
      );

      return {
        message: "Channel updated",
        data: channelDataUpdated,
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        viewableRole: t.Optional(t.Array(t.String())),
        isArchived: t.Optional(t.Boolean()),
      }),
      detail: {
        description: "チャンネル情報を更新します",
        tags: ["Channel"],
      },
      checkRoleTerm: "manageChannel",
    },
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
    async ({ body: { channelId }, server }) => {
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

      //チャンネル参加者にWSで通知
      server?.publish(
        `channel::${channelId}`,
        JSON.stringify({
          signal: "channel::Deleted",
          data: {
            channelId,
          },
        }),
      );
      //チャンネルに参加しているユーザーのWS登録を解除
      await db.channelJoin
        .findMany({
          where: {
            channelId,
          },
        })
        .then((data) => {
          for (const channelJoinData of data) {
            //userWSInstance.get(channelJoinData.userId)?.unsubscribe(`channel::${channelId}`);
            WSUnsubscribe(channelJoinData.userId, `channel::${channelId}`);
          }
        });

      //既読時間データを削除
      await db.messageReadTime.deleteMany({
        where: {
          channelId,
        },
      });
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
