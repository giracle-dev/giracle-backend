import { mkdir } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { urlPreviewControl } from "../../Middlewares";
import CheckChannelVisibility from "../../Utils/CheckChannelVisitiblity";
import GetUserViewableChannel from "../../Utils/GetUserViewableChannel";

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

      //チャンネルの閲覧制限があるか確認してから返す
      if (await CheckChannelVisibility(messageData.channelId, _userId)) {
        return {
          message: "Fetched message",
          data: messageData,
        };
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
        throw error(404, "Read time not found");
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
        //throw error(400, "Read time is already newer");
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
          throw error(403, "You are not allowed to view this channel");
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
        throw error(400, "File size is too large");
      }

      //保存するためのファイル名保存
      const fileNameGen = `${Date.now()}_${file.name}`;
      //チャンネルIdのディレクトリを作成
      await mkdir(`./STORAGE/file/${channelId}`, { recursive: true });

      //ファイルを保存
      await Bun.write(`./STORAGE/file/${channelId}/${fileNameGen}`, file);

      //ファイル情報を作成、保存する
      const fileData = await db.messageFileAttached.create({
        data: {
          channelId,
          userId: _userId,
          size: file.size,
          actualFileName: file.name,
          savedFileName: fileNameGen,
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
        throw error(404, "File not found");
      }

      const fileBuffer = Bun.file(
        `./STORAGE/file/${fileData.channelId}/${fileData.savedFileName}`,
      );

      //ファイル名を適用させてファイルを返す
      return new Response(fileBuffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${fileData.actualFileName}"`,
        },
      });
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
        throw error(404, "Message not found");
      }
      if (messageData.userId !== _userId) {
        throw error(403, "You are not owner of this message");
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
        await unlink(`./STORAGE/file/${file.channelId}/${file.savedFileName}`);
      }
      //添付ファイル情報の削除
      await db.messageFileAttached.deleteMany({
        where: {
          messageId,
        },
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
          data: messageData.id,
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
          data: null
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
  .use(urlPreviewControl)
  .post(
    "/send",
    async ({ body: { channelId, message, fileIds }, _userId, server }) => {
      //メッセージが空白か改行しか含まれていないならエラー(ファイル添付があるなら除外)
      const spaceCount =
        (message.match(/ /g) || "").length +
        (message.match(/　/g) || "").length +
        (message.match(/\n/g) || "").length;
      if (spaceCount === message.length && fileIds.length === 0)
        throw error(400, "Message is empty");

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
      }),
      detail: {
        description: "メッセージを送信します",
        tags: ["Message"],
      },
      bindUrlPreview: true,
    },
  );
