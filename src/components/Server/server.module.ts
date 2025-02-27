import fs from "node:fs";
import { unlink } from "node:fs/promises";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";
import sharp from "sharp";

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
      //デフォルトで参加するチャンネル
      const defaultJoinChannelFetched = await db.channelJoinOnDefault.findMany({
        select: {
          channel: true,
        },
      });
      const defaultJoinChannel = defaultJoinChannelFetched.map(
        (c) => c.channel,
      );

      return {
        message: "Server config fetched",
        data: { ...config, isFirstUser, defaultJoinChannel, id: undefined }, // idは返さない,
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
      body: {
        RegisterAvailable,
        RegisterInviteOnly,
        RegisterAnnounceChannelId,
        MessageMaxLength,
        DefaultJoinChannel,
      },
      server,
    }) => {
      await db.serverConfig.updateMany({
        data: {
          RegisterAvailable,
          RegisterInviteOnly,
          RegisterAnnounceChannelId,
          MessageMaxLength,
        },
      });

      //デフォルト参加チャンネル設定もあるなら更新する
      if (DefaultJoinChannel) {
        //デフォルト参加チャンネル全部削除
        await db.channelJoinOnDefault.deleteMany({});
        //渡されたチャンネルIdごとにDBへ挿入
        for (const channelId of DefaultJoinChannel) {
          await db.channelJoinOnDefault.create({
            data: {
              channelId,
            },
          });
        }
      }

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
        RegisterAnnounceChannelId: t.Optional(t.String()),
        MessageMaxLength: t.Optional(t.Number()),
        DefaultJoinChannel: t.Optional(t.Array(t.String())),
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
    },
  )
  .get(
    "/custom-emoji/:code",
    async ({ params: {code} }) => {
      //絵文字データを取得、無ければエラー
      const emoji = await db.customEmoji.findFirst({
        where: {
          code,
        },
      });
      if (emoji === null) return error(404, "Custom emoji not found");

      //アイコン読み取り、存在確認して返す
      const emojiGif = Bun.file(`./STORAGE/custom-emoji/${emoji.id}.gif`);
      if (await emojiGif.exists()) return emojiGif;
      const emojiJpeg = Bun.file(`./STORAGE/custom-emoji/${emoji.id}.jpeg`);
      if (await emojiJpeg.exists()) return emojiJpeg;

      return error(404, "Custom emoji not found");
    },
    {
      params: t.Object({
        code: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "指定のカスタム絵文字を取得します",
        tags: ["Server"],
      }
    }
  )
  .get(
    "/custom-emoji",
    async () => {
      const customEmojis = await db.customEmoji.findMany();

      return {
        message: "Custom emojis fetched",
        data: customEmojis,
      };
    },
    {
      detail: {
        description: "カスタム絵文字一覧を取得します",
        tags: ["Server"],
      }
    }
  )
  .put(
    "/custom-emoji/upload",
    async ({ body:{ emoji, emojiCode }, server, _userId }) => {
      if (emoji.size > 8 * 1024 * 1024) {
        return error(400, "Emoji's file size is too large");
      }
      if (
        emoji.type !== "image/png" &&
        emoji.type !== "image/gif" &&
        emoji.type !== "image/jpeg"
      ) {
        return error(400, "File type is invalid");
      }

      //絵文字コードが既に存在するか確認
      const emojiExist = await db.customEmoji.findFirst({
        where: {
          code: emojiCode,
        },
      });
      if (emojiExist !== null) return error(400, "Emoji code already exists");

      //DBに登録
      const emojiUploaded = await db.customEmoji.create({
        data: {
          code: emojiCode,
          uploadedUserId: _userId,
        }
      });

      //拡張子取得
      const ext = emoji.type.split("/")[1];
      //拡張子に合わせて画像を変換
      if (ext === "gif") {
        await sharp(await emoji.arrayBuffer(), { animated: true })
          .resize(32, 32)
          .gif()
          .toFile(`./STORAGE/custom-emoji/${emojiUploaded.id}.gif`);
      } else {
        await sharp(await emoji.arrayBuffer())
          .resize(32, 32)
          .jpeg({ mozjpeg: true, quality: 90 })
          .toFile(`./STORAGE/custom-emoji/${emojiUploaded.id}.jpeg`);
      }

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "server::CustomEmojiUploaded",
          data: emojiUploaded,
        })
      );

      return {
        message: "Emoji uploaded",
        data: emojiUploaded
      };
    },
    {
      body: t.Object({
        emojiCode: t.String({ minLength: 1 }),
        emoji: t.File(),
      }),
      detail: {
        description: "カスタム絵文字を追加します",
        tags: ["Server"],
      }
    }
  )
  .delete(
    "/custom-emoji/delete",
    async ({ body: {emojiCode}, server }) => {
      //絵文字を削除しデータ取得
      const emojiDeleted = await db.customEmoji.delete({
        where: {
          code: emojiCode,
        }
      });

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "server::CustomEmojiDeleted",
          data: emojiDeleted,
        })
      );

      return {
        message: "Emoji deleted",
        data: emojiDeleted
      };
    },
    {
      body: t.Object({
        emojiCode: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "カスタム絵文字を削除します",
        tags: ["Server"],
      }
    }
  )
  .get(
    "/storage-usage",
    async () => {
      //ディレクトリ一覧を取得
      const dirs = fs.readdirSync("./STORAGE/file");
      if (dirs.length === 0) return 0;

      //合計サイズ
      let totalSize = 0;

      //ディレクトリごとにファイルを取得、パスを格納する
      for (const dir of dirs) {
        const insideDir = fs.readdirSync(`./STORAGE/file/${dir}`);
        for (const f of insideDir) {
          totalSize += fs.statSync(path.join(`./STORAGE/file/${dir}`, f)).size;
        }
      }

      return {
        message: "Server storage usage fetched",
        data: totalSize,
      };
    },
    {
      detail: {
        description: "サーバーのストレージ使用量を取得します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer",
    },
  );
