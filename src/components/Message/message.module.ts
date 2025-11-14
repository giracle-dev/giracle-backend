import { mkdir } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { type Message, PrismaClient } from "@prisma/client";
import Elysia, { status, file, t } from "elysia";
import sharp from "sharp";
import CheckToken, { urlPreviewControl } from "../../Middlewares";
import CheckChannelVisibility from "../../Utils/CheckChannelVisitiblity";
import GetUserViewableChannel from "../../Utils/GetUserViewableChannel";
import { apnsService } from "../../services/apns.service";

const db = new PrismaClient();

export const message = new Elysia({ prefix: "/message" })
  .use(CheckToken)
  .get(
    "/:messageId",
    async ({ params: { messageId }, _userId }) => {
      const messageData = await db.message.findUnique({
        where: {
          id: messageId,
        },
      });
      //メッセージが見つからなければエラー
      if (messageData === null) {
        return status(404, "Message not found");
      }

      //チャンネルの閲覧制限があるか確認してから返す
      if (await CheckChannelVisibility(messageData.channelId, _userId)) {
        return {
          message: "Fetched message",
          data: messageData,
        };
      }

      return status(404, "Message not found");
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
    "/get-new",
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
      const JSONNews: { [key: string]: boolean } = {};

      //チャンネルごとの最新メッセージを取得、比較
      for (const channelId of channelIds) {
        //指定のチャンネルIdの最新メッセージを取得
        const newest = await db.message.findFirst({
          where: {
            channelId,
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
            JSONNews[channelId] =
              newest.createdAt.valueOf() > readTimeData?.readTime.valueOf();
          } else {
            JSONNews[channelId] = false;
          }
        } else {
          //存在しないならfalse
          JSONNews[channelId] = false;
        }
      }

      return {
        message: "Fetched news",
        data: JSONNews,
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
      const readTime = await db.messageReadTime.findMany({
        where: {
          userId: _userId,
        },
      });
      //既読時間がない場合はエラー
      if (readTime === null) {
        throw status(404, "Read time not found");
      }

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
      const readTimeSaved = await db.messageReadTime.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId: _userId,
          },
        },
      });
      if (
        readTimeSaved !== null &&
        readTimeSaved.readTime.valueOf() > readTime.valueOf()
      ) {
        //throw status(400, "Read time is already newer");
        return {
          message: "Read time is already newer",
          data: readTimeSaved,
        };
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
  .get(
    "/search",
    async ({
      query: {
        content,
        channelId,
        userId,
        hasUrlPreview,
        hasFileAttachment,
        loadIndex,
        sort,
      },
      _userId,
    }) => {
      //デフォルトのソート順を設定
      if (sort === undefined) sort = "desc";
      //読み込みインデックス指定があるならスキップするメッセ数を計算
      const messageSkipping = loadIndex ? (loadIndex - 1) * 50 : 0;

      //チャンネル指定が無かった時用のユーザーが閲覧できるチャンネルId配列
      let viewableChannelIds: string[] = [];
      //チャンネル指定があるなら閲覧制限を確認する、無いならユーザーが閲覧できるチャンネルを取得
      if (channelId) {
        //チャンネルの閲覧制限があるか確認
        if (!(await CheckChannelVisibility(channelId, _userId))) {
          throw status(403, "You are not allowed to view this channel");
        }
      } else {
        const viewableChannels = await GetUserViewableChannel(_userId, false);
        viewableChannelIds = viewableChannels.map((channel) => channel.id);
      }

      //URLプレビューがあるかどうかの条件を変換
      const relationOptionGetter = (_opt: boolean | undefined) => {
        switch (_opt) {
          case undefined:
            return undefined;
          case true:
            return {
              some: {},
            };
          case false:
            return {
              none: {},
            };
        }
      };

      //メッセージを検索する
      const messages = await db.message.findMany({
        where: {
          content: {
            contains: content,
          },
          channelId: channelId
            ? { equals: channelId }
            : { in: viewableChannelIds },
          userId: userId ? { equals: userId } : undefined,
          MessageUrlPreview: relationOptionGetter(hasUrlPreview),
          MessageFileAttached: relationOptionGetter(hasFileAttachment),
        },
        include: {
          MessageUrlPreview: true,
          MessageFileAttached: true,
        },
        take: 50,
        skip: messageSkipping,
        orderBy: {
          createdAt: sort,
        },
      });

      return {
        message: "Searched messages",
        data: messages,
      };
    },
    {
      query: t.Object({
        content: t.Optional(t.String({ minLength: 1 })),
        channelId: t.Optional(t.String({ minLength: 1 })),
        userId: t.Optional(t.String({ minLength: 1 })),
        hasUrlPreview: t.Optional(t.Union([t.Boolean(), t.Undefined()])),
        hasFileAttachment: t.Optional(t.Union([t.Boolean(), t.Undefined()])),
        loadIndex: t.Optional(t.Number({ minimum: 1, default: 1 })),
        sort: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      }),
      detail: {
        description: "メッセージを検索します",
        tags: ["Message"],
      },
    },
  )
  .post(
    "/file/upload",
    async ({ body: { channelId, file }, _userId }) => {
      //ファイルサイズが500MBを超える場合はエラー
      if (file.size > 1024 * 1024 * 500) {
        throw status(400, "File size is too large");
      }

      //保存するためのファイル名保存
      const fileNameGen = `${Date.now()}_${file.name}`;
      //チャンネルIdのディレクトリを作成
      await mkdir(`./STORAGE/file/${channelId}`, { recursive: true }).catch(
        () => {},
      );

      console.log("message.module :: /file/upload : file.type->", file.type);
      //webpファイルであるかどうかフラグ
      let isWebp = false;

      //ファイルを保存する
      if (file.type.startsWith("image/") && file.type !== "image/gif") {
        await sharp(await file.arrayBuffer())
          .rotate()
          .webp({ quality: 95 })
          .toFile(`./STORAGE/file/${channelId}/${fileNameGen}.webp`);
        //webpで保存されたことと設定
        isWebp = true;
      } else if (file.type === "image/gif") {
        await sharp(await file.arrayBuffer(), { animated: true })
          .gif({
            colours: 128, // 色数を128に削減
            dither: 0, // ディザリングを無効化
            effort: 7, // パレット生成の計算量を設定
          })
          .toFile(`./STORAGE/file/${channelId}/${fileNameGen}`);
      } else {
        //ファイルを保存
        await Bun.write(`./STORAGE/file/${channelId}/${fileNameGen}`, file);
      }

      //ファイル情報を作成、保存する
      const fileData = await db.messageFileAttached.create({
        data: {
          channelId,
          userId: _userId,
          size: file.size,
          actualFileName: isWebp ? `${file.name}.webp` : file.name,
          savedFileName: isWebp ? `${fileNameGen}.webp` : fileNameGen,
          type: file.type,
        },
      });

      return {
        message: "File uploaded",
        data: {
          fileId: fileData.id,
        },
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
        file: t.File(),
      }),
      detail: {
        description: "ファイルをアップロードします",
        tags: ["Message"],
      },
    },
  )
  .get(
    "/file/:fileId",
    async ({ params: { fileId } }) => {
      const fileData = await db.messageFileAttached.findUnique({
        where: {
          id: fileId,
        },
      });

      if (fileData === null) {
        throw status(404, "File not found");
      }

      return file(
        `./STORAGE/file/${fileData.channelId}/${fileData.savedFileName}`,
      );
    },
    {
      params: t.Object({
        fileId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "ファイルをアップロードします",
        tags: ["Message"],
      },
    },
  )
  .delete(
    "/delete",
    async ({ body: { messageId }, _userId, server }) => {
      //取得
      const messageData = await db.message.findUnique({
        where: {
          id: messageId,
        },
      });
      if (messageData === null) {
        throw status(404, "Message not found");
      }
      if (messageData.userId !== _userId) {
        //メッセージの送信者でないならサーバー管理権限を確認する
        const canManageServer = await db.roleLink.findFirst({
          where: {
            userId: _userId,
            role: {
              manageServer: true,
            },
          },
        });

        if (!canManageServer)
          throw status(403, "You are not owner of this message");
      }

      //URLプレビューの削除
      await db.messageUrlPreview.deleteMany({
        where: {
          messageId,
        },
      });
      //ファイル情報の取得、削除
      const fileData = await db.messageFileAttached.findMany({
        where: {
          messageId,
        },
      });
      for (const file of fileData) {
        try {
          await unlink(
            `./STORAGE/file/${file.channelId}/${file.savedFileName}`,
          );
        } catch (e) {
          console.error("message.module :: /message/delete : 削除エラー->", e);
        }
      }
      //リアクションデータを削除
      await db.messageReaction.deleteMany({
        where: {
          messageId,
        },
      });
      //添付ファイル情報の削除
      await db.messageFileAttached.deleteMany({
        where: {
          messageId,
        },
      });
      //このメッセージからできているInboxデータの削除
      await db.inbox.deleteMany({
        where: {
          messageId: messageId,
        }
      });

      //メッセージの削除
      await db.message.delete({
        where: {
          id: messageId,
        },
      });

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "message::MessageDeleted",
          data: {
            messageId: messageData.id,
            channelId: messageData.channelId,
          },
        }),
      );

      return {
        message: "Message deleted",
        data: messageData.id,
      };
    },
    {
      body: t.Object({
        messageId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "メッセージを削除します",
        tags: ["Message"],
      },
    },
  )
  .get(
    "/inbox",
    async ({ _userId }) => {
      //通知を取得する
      const inboxAll = await db.inbox.findMany({
        where: {
          userId: _userId,
        },
        include: {
          Message: true,
        },
      });

      return {
        message: "Fetched inbox",
        data: inboxAll,
      };
    },
    {
      detail: {
        description: "通知を取得します",
        tags: ["Message"],
      },
    },
  )
  .post(
    "/inbox/read",
    async ({ body: { messageId }, _userId, server }) => {
      //通知を削除
      await db.inbox.delete({
        where: {
          messageId_userId: {
            messageId,
            userId: _userId,
          },
        },
      });

      //WSで通知の既読を通知
      server?.publish(
        `user::${_userId}`,
        JSON.stringify({
          signal: "inbox::Deleted",
          data: {
            messageId,
            type: "mention",
          },
        }),
      );

      return {
        message: "Inbox read",
        data: messageId,
      };
    },
    {
      body: t.Object({
        messageId: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "通知を既読にします",
        tags: ["Message"],
      },
    },
  )
  .post(
    "/inbox/clear",
    async ({ _userId, server }) => {
      //通知を全部削除
      await db.inbox.deleteMany({
        where: {
          userId: _userId,
        },
      });

      //WSで通知の全既読を通知
      server?.publish(
        `user::${_userId}`,
        JSON.stringify({
          signal: "inbox::Clear",
          data: null,
        }),
      );

      return {
        message: "Inbox cleared",
        data: null,
      };
    },
    {
      detail: {
        description: "通知をすべて既読したとして削除する",
        tags: ["Message"],
      },
    },
  )
  .post(
    "/emoji-reaction",
    async ({ body: { messageId, channelId, emojiCode }, _userId, server }) => {
      //自分のリアクションデータを取得して条件確認する
      const MyReactions = await db.messageReaction.findMany({
        where: {
          messageId,
          userId: _userId,
        },
      });
      //同じ絵文字コードのリアクションがあればエラー
      if (MyReactions.some((r) => r.emojiCode === emojiCode)) {
        throw status(400, "You already reacted this message");
      }
      //同じユーザーリアクションが10以上ならエラー
      if (MyReactions.length >= 10) {
        throw status(400, "You can't react more than 10 times");
      }

      //リアクションを格納
      const reaction = await db.messageReaction.create({
        data: {
          messageId,
          userId: _userId,
          channelId,
          emojiCode,
        },
      });

      //WSで通知
      server?.publish(
        `channel::${channelId}`,
        JSON.stringify({
          signal: "message::AddReaction",
          data: reaction,
        }),
      );

      return {
        message: "Message reacted.",
        data: reaction,
      };
    },
    {
      body: t.Object({
        messageId: t.String({ minLength: 1 }),
        channelId: t.String({ minLength: 1 }),
        emojiCode: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "絵文字リアクションをする",
        tags: ["Message"],
      },
    },
  )
  .get(
    "/who-reacted",
    async ({ query: { messageId, emojiCode, length }, _userId }) => {
      //メッセージが存在するか確認
      const message = await db.message.findUnique({
        where: {
          id: messageId,
        },
        include: {
          MessageReaction: {
            take: length,
            where: {
              emojiCode,
            },
          },
        },
      });
      if (message === null) {
        throw status(400, "Message not found or is private.");
      }

      //チャンネルの閲覧制限があるか確認
      const viewable = await CheckChannelVisibility(message.channelId, _userId);
      if (!viewable) {
        throw status(400, "Message not found or is private.");
      }

      return {
        message: "Fetched reactions",
        data: message.MessageReaction.map((r) => r.userId),
      };
    },
    {
      query: t.Object({
        messageId: t.String({ minLength: 1 }),
        emojiCode: t.String({ minLength: 1 }),
        length: t.Number({ minimum: 1, default: 5 }),
      }),
      detail: {
        description: "絵文字リアクションをしたユーザーを取得する",
        tags: ["Message"],
      },
    },
  )
  .delete(
    "/delete-emoji-reaction",
    async ({ body: { messageId, channelId, emojiCode }, _userId, server }) => {
      //自分のリアクションを取得して無ければエラー
      const hasMyReaction = await db.messageReaction.findFirst({
        where: {
          messageId,
          userId: _userId,
          emojiCode,
        },
      });
      if (hasMyReaction === null) {
        throw status(404, "Reaction does not exists");
      }

      //リアクションを削除
      const reactionDeleted = await db.messageReaction.delete({
        where: {
          id: hasMyReaction.id,
        },
      });

      //WSで通知
      server?.publish(
        `channel::${channelId}`,
        JSON.stringify({
          signal: "message::DeleteReaction",
          data: reactionDeleted,
        }),
      );

      return {
        message: "Reaction deleted.",
        data: reactionDeleted,
      };
    },
    {
      body: t.Object({
        messageId: t.String({ minLength: 1 }),
        channelId: t.String({ minLength: 1 }),
        emojiCode: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "自分の絵文字リアクションを削除する",
        tags: ["Message"],
      },
    },
  )

  .use(urlPreviewControl)

  .post(
    "/send",
    async ({
      body: { channelId, message, fileIds, replyingMessageId },
      _userId,
      server,
    }) => {
      //メッセージが空白か改行しか含まれていないならエラー(ファイル添付があるなら除外)
      const spaceCount =
        (message.match(/ /g) || "").length +
        (message.match(/　/g) || "").length +
        (message.match(/\n/g) || "").length;
      if (spaceCount === message.length && fileIds.length === 0)
        throw status(400, "Message is empty");

      //チャンネル参加情報を取得
      const channelJoined = await db.channelJoin.findFirst({
        where: {
          userId: _userId,
          channelId,
        },
      });
      //チャンネルに参加していない
      if (channelJoined === null) {
        throw status(400, "You are not joined this channel");
      }

      //返信先メッセージ用変数(メッセージ保存処理後に使用)
      let messageReplyingTo: Message | null = null;
      //返信先メッセージがあるなら存在するか確認
      if (replyingMessageId) {
        messageReplyingTo = await db.message.findUnique({
          where: {
            id: replyingMessageId,
          },
        });
        //返信先メッセージが存在しないならエラー
        if (messageReplyingTo === null) {
          throw status(400, "Replying message not found");
        }
        //返信先メッセージがこのチャンネルに存在するか確認
        if (messageReplyingTo.channelId !== channelId) {
          throw status(400, "Replying message not found in this channel");
        }
      }

      //アップロードしているファイルId配列があるならファイル情報を取得
      const fileData = await db.messageFileAttached.findMany({
        where: {
          id: {
            in: fileIds,
          },
        },
      });

      //メッセージを保存
      const messageSaved = await db.message.create({
        data: {
          channelId,
          userId: _userId,
          content: message,
          replyingMessageId: replyingMessageId ?? undefined,
          MessageFileAttached: {
            connect: fileData.map((data) => {
              return {
                id: data.id,
              };
            }),
          },
        },
        include: {
          MessageFileAttached: true,
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

      //メッセージから "@<userId>" を検知
      const mentionedUserIds =
        message.match(/@<([\w-]+)>/g)?.map((mention) => mention.slice(2, -1)) ||
        [];

      //メンションされたユーザーに通知
      for (const mentionedUserId of mentionedUserIds) {
        //メンションされたユーザーのIdを取得
        await db.inbox.create({
          data: {
            userId: mentionedUserId,
            messageId: messageSaved.id,
            type: "mention",
          },
        });
        //メンションされたWSで通知
        server?.publish(
          `user::${mentionedUserId}`,
          JSON.stringify({
            signal: "inbox::Added",
            data: {
              message: messageSaved,
              type: "mention",
            },
          }),
        );
      }

      //返信メッセージがあるなら返信先の送信者に通知(自分自身には通知しない)
      if (
        replyingMessageId &&
        messageReplyingTo &&
        messageReplyingTo.userId !== _userId
      ) {
        await db.inbox.create({
          data: {
            userId: messageReplyingTo.userId,
            messageId: messageSaved.id,
            type: "reply",
          },
        });
        //WS通知
        server?.publish(
          `user::${messageReplyingTo.userId}`,
          JSON.stringify({
            signal: "inbox::Added",
            data: {
              message: messageSaved,
              type: "reply",
            },
          }),
        );
      }

      // プッシュ通知の送信（APNsが初期化されている場合のみ）
      if (apnsService.isReady()) {
        try {
          // チャンネル名と送信者の情報を取得
          const channelInfo = await db.channel.findUnique({
            where: { id: channelId },
            select: { name: true },
          });
          const senderInfo = await db.user.findUnique({
            where: { id: _userId },
            select: { name: true },
          });

          // チャンネルに参加しているすべてのユーザーを取得（メンション置き換え用）
          const allChannelMembers = await db.channelJoin.findMany({
            where: { channelId },
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          });

          // userId -> userName のマッピングを作成
          const userIdToNameMap = new Map<string, string>();
          for (const member of allChannelMembers) {
            userIdToNameMap.set(member.user.id, member.user.name || "Unknown");
          }

          // メッセージ内の @<userId> をユーザー名に置き換え
          let displayMessage = message;
          const mentionPattern = /@<([a-f0-9-]+)>/g;
          displayMessage = displayMessage.replace(
            mentionPattern,
            (match, userId) => {
              const userName = userIdToNameMap.get(userId);
              return userName ? `@${userName}` : match;
            },
          );

          // チャンネルに参加しているユーザー（送信者以外）のデバイストークンを取得
          const channelMembers = await db.channelJoin.findMany({
            where: {
              channelId,
              userId: { not: _userId }, // 送信者自身は除外
            },
            include: {
              user: {
                include: {
                  DeviceToken: {
                    where: {
                      platform: "ios",
                      isActive: true,
                    },
                  },
                },
              },
            },
          });

          // iOSデバイストークンを収集（通知設定を考慮）
          const deviceTokens: string[] = [];
          for (const member of channelMembers) {
            const userId = member.user.id;

            for (const deviceToken of member.user.DeviceToken) {
              const mode = deviceToken.notificationMode;

              // "off" の場合は通知を送らない
              if (mode === "off") {
                continue;
              }

              // "mentions" の場合はメンションされている場合のみ通知
              if (mode === "mentions") {
                const isMentioned =
                  message.includes(`@<${userId}>`) ||
                  message.includes("@channel") ||
                  message.includes("@everyone");

                if (!isMentioned) {
                  continue;
                }
              }

              // "all" の場合、または上記の条件を満たす場合は通知を送る
              deviceTokens.push(deviceToken.deviceToken);
            }
          }

          // デバイストークンがある場合のみ送信
          if (deviceTokens.length > 0) {
            // 表示用メッセージを使用（メンションがユーザー名に置き換えられている）
            const notificationBody = displayMessage.length > 100
              ? `${displayMessage.substring(0, 97)}...`
              : displayMessage;

            await apnsService.sendNotification(deviceTokens, {
              title: `${senderInfo?.name || "Someone"} in #${channelInfo?.name || "channel"}`,
              body: notificationBody,
              badge: 1,
              data: {
                channelId: channelId,
                messageId: messageSaved.id,
                type: "message",
              },
            });
          }
        } catch (error) {
          // プッシュ通知の失敗はメッセージ送信の失敗にはしない
          console.error("Failed to send push notification:", error);
        }
      }

      return {
        message: "Message sent",
        data: messageSaved,
      };
    },
    {
      body: t.Object({
        channelId: t.String({ minLength: 1 }),
        message: t.String(),
        fileIds: t.Array(t.String({ minLength: 1 })),
        replyingMessageId: t.Optional(t.String()),
      }),
      detail: {
        description: "メッセージを送信します",
        tags: ["Message"],
      },
      bindUrlPreview: true,
    },
  )
  .post(
    "/edit",
    async ({ body: { messageId, content }, _userId, server }) => {
      const msg = await db.message.findUnique({
        where: {
          id: messageId,
        },
      });
      //メッセージが無かった時エラー
      if (msg === null) {
        throw status(404, "Message not found");
      }
      //送信者が自分と違うならエラー
      if (msg.userId !== _userId) {
        throw status(403, "You are not sender of this message");
      }
      //内容が同じならエラー
      if (msg.content === content) {
        throw status(400, "Message is already same");
      }

      //メッセージデータを更新する
      const msgUpdated = await db.message.update({
        where: {
          id: messageId,
        },
        data: {
          content,
          isEdited: true,
        },
      });

      //WSで通知
      server?.publish(
        `channel::${msg.channelId}`,
        JSON.stringify({
          signal: "message::UpdateMessage",
          data: msgUpdated,
        }),
      );

      return {
        message: "Message edited",
        data: msgUpdated,
      };
    },
    {
      body: t.Object({
        messageId: t.String({ minLength: 1 }),
        content: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "メッセージを編集します",
        tags: ["Message"],
      },
      bindUrlPreview: true,
    },
  );
