import fs from "node:fs";
import { unlink } from "node:fs/promises";
import * as path from "node:path";
import { status } from "elysia";
import sharp from "sharp";
import { db } from "../..";

export namespace ServiceServer {
  export const Config = async () => {
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
    const defaultJoinChannel = defaultJoinChannelFetched.map((c) => c.channel);

    return {
      config,
      isFirstUser,
      defaultJoinChannel,
    };
  };

  export const Banner = async () => {
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

    throw status(404, "Banner not found");
  };

  export const GetInvite = async () => {
    const invites = await db.invitation.findMany();
    return invites;
  };

  export const CreateInvite = async (inviteCode: string, _userId: string) => {
    const newInvite = await db.invitation.create({
      data: {
        inviteCode,
        createdUserId: _userId,
      },
    });

    return newInvite;
  };

  export const DeleteInvite = async (inviteId: number) => {
    await db.invitation.delete({
      where: {
        id: inviteId,
      },
    });

    return;
  };

  export const ChangeInfo = async (name: string, introduction: string) => {
    const serverinfo = await db.serverConfig.updateManyAndReturn({
      data: {
        name,
        introduction,
      },
    });

    //ここでデータ取得失敗したら500エラー
    if (serverinfo === null) throw status(500, "Server config not found");

    return serverinfo[0];
  };

  export const ChangeConfig = async (
    RegisterAvailable?: boolean,
    RegisterInviteOnly?: boolean,
    RegisterAnnounceChannelId?: string,
    MessageMaxLength?: number,
    DefaultJoinChannel?: string[],
  ) => {
    const serverinfo = await db.serverConfig.updateManyAndReturn({
      data: {
        RegisterAvailable,
        RegisterInviteOnly,
        RegisterAnnounceChannelId,
        MessageMaxLength,
      },
    });

    //ここでデータ取得
    if (serverinfo === null) throw status(500, "Server config not found");

    //デフォルト参加チャンネル設定もあるなら更新する
    if (DefaultJoinChannel) {
      //デフォルト参加チャンネル全部削除
      await db.channelJoinOnDefault.deleteMany({});
      const defaultChannelIdsPushing: { channelId: string }[] = [];
      //渡されたチャンネルIdをDBへ追加
      for (const channelId of DefaultJoinChannel) {
        defaultChannelIdsPushing.push({ channelId });
      }
      await db.channelJoinOnDefault.createMany({
        data: defaultChannelIdsPushing,
      });
    }

    return serverinfo[0];
  };

  export const ChangeBanner = async (banner: File) => {
    if (banner.size > 15 * 1024 * 1024) {
      throw status(400, "File size is too large");
    }
    if (
      banner.type !== "image/png" &&
      banner.type !== "image/gif" &&
      banner.type !== "image/jpeg"
    ) {
      throw status(400, "File type is invalid");
    }

    //拡張子取得
    const ext = banner.type.split("/")[1];

    //既存のバナーを削除
    await unlink("./STORAGE/banner/SERVER.png").catch(() => {});
    await unlink("./STORAGE/banner/SERVER.gif").catch(() => {});
    await unlink("./STORAGE/banner/SERVER.jpeg").catch(() => {});

    //バナーを保存
    Bun.write(`./STORAGE/banner/SERVER.${ext}`, banner);

    return;
  };

  export const GetCustomEmoji = async (code: string) => {
    //絵文字データを取得、無ければエラー
    const emoji = await db.customEmoji.findFirst({
      where: {
        code,
      },
    });
    if (emoji === null) throw status(404, "Custom emoji not found");

    //アイコン読み取り、存在確認して返す
    const emojiGif = Bun.file(`./STORAGE/custom-emoji/${emoji.id}.gif`);
    if (await emojiGif.exists()) return emojiGif;
    const emojiJpeg = Bun.file(`./STORAGE/custom-emoji/${emoji.id}.jpeg`);
    if (await emojiJpeg.exists()) return emojiJpeg;
    const emojiWebp = Bun.file(`./STORAGE/custom-emoji/${emoji.id}.webp`);
    if (await emojiWebp.exists()) return emojiWebp;

    return null;
  };

  export const GetCustomEmojis = async () => {
    const emojis = await db.customEmoji.findMany();
    return emojis;
  };

  export const uploadCustomEmoji = async (
    emoji: File,
    emojiCode: string,
    _userId: string,
  ) => {
    if (emoji.size > 8 * 1024 * 1024) {
      throw status(400, "Emoji's file size is too large");
    }
    if (
      emoji.type !== "image/png" &&
      emoji.type !== "image/gif" &&
      emoji.type !== "image/jpeg"
    ) {
      throw status(400, "File type is invalid");
    }

    //絵文字コードのバリデーション
    if (emojiCode.includes(" "))
      throw status(400, "Emoji code cannot contain spaces");
    if (/[^\u0020-\u007E]/.test(emojiCode))
      throw status(400, "Emoji code cannot contain full-width characters");

    //絵文字コードが既に存在するか確認
    const emojiExist = await db.customEmoji.findFirst({
      where: {
        code: emojiCode,
      },
    });
    if (emojiExist !== null) throw status(400, "Emoji code already exists");

    //DBに登録
    const emojiUploaded = await db.customEmoji.create({
      data: {
        code: emojiCode,
        uploadedUserId: _userId,
      },
    });

    //拡張子取得
    const ext = emoji.type.split("/")[1];
    //拡張子に合わせて画像を変換
    if (ext === "gif") {
      await sharp(await emoji.arrayBuffer(), { animated: true })
        .resize(32, 32)
        .gif({
          colours: 128, // 色数を128に削減
          dither: 0, // ディザリングを無効化
          effort: 7, // パレット生成の計算量を設定
        })
        .toFile(`./STORAGE/custom-emoji/${emojiUploaded.id}.gif`);
    } else {
      await sharp(await emoji.arrayBuffer())
        .rotate()
        .resize(32, 32)
        .webp({ quality: 95 })
        .toFile(`./STORAGE/custom-emoji/${emojiUploaded.id}.webp`);
    }

    return emojiUploaded;
  };

  export const DeleteCustomEmoji = async (emojiCode: string) => {
    //絵文字を削除しデータ取得
    const emojiDeleted = await db.customEmoji.delete({
      where: {
        code: emojiCode,
      },
    });

    //絵文字の画像ファイルを削除
    await unlink(`./STORAGE/custom-emoji/${emojiDeleted.id}.png`).catch(
      () => {},
    );
    await unlink(`./STORAGE/custom-emoji/${emojiDeleted.id}.gif`).catch(
      () => {},
    );
    await unlink(`./STORAGE/custom-emoji/${emojiDeleted.id}.jpeg`).catch(
      () => {},
    );
    await unlink(`./STORAGE/custom-emoji/${emojiDeleted.id}.webp`).catch(
      () => {},
    );

    return emojiDeleted;
  };

  export const StorageUsage = async () => {
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
    return totalSize;
  };
}
