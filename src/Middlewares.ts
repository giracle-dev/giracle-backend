import { type Message, PrismaClient } from "@prisma/client";
import { Elysia, status, t } from "elysia";
import ogs from "open-graph-scraper";

const db = new PrismaClient();

const CheckToken = new Elysia({ name: "CheckToken" })
  .guard({
    cookie: t.Object(
      { token: t.String({ minLength: 1 }) },
      { error: "Cookie for token is not valid." },
    ),
  })
  .resolve({ as: "scoped" }, async ({ cookie: { token } }) => {
    //そもそもCookieが無いならエラー
    if (token.value === undefined) {
      return status(401, "Invalid token");
    }

    //トークンがDBにあるか確認
    const tokenData = await db.token.findUnique({
      where: {
        token: token.value,
      },
      include: {
        user: true,
      },
    });

    //トークンが無効ならエラー
    if (tokenData === null) {
      return status(401, "Invalid token");
    }
    //BAN確認
    if (tokenData.user.isBanned) {
      return status(401, "User is banned");
    }

    //トークンの期限を延長
    token.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); //15日間有効

    return {
      _userId: tokenData.userId,
    };
  });

const checkRoleTerm = new Elysia({ name: "checkRoleTerm" })
  .use(CheckToken)
  //.macro(({ onBeforeHandle }) => ({
  .macro({
    checkRoleTerm(roleTerm: string) {
      return {
        async beforeHandle({ _userId }) {
          //console.log("Middlewares :: checkRoleTerm : 送信者のユーザーId->", _userId);

          //管理者権限を持つユーザーなら問答無用で通す
          const isAdmin = await db.roleLink.findFirst({
            where: {
              userId: _userId,
              role: {
                manageServer: true,
              },
            },
          });
          if (isAdmin !== null) {
            return;
          }

          //該当権限を持つロール付与情報を検索
          const roleLink = await db.roleLink.findFirst({
            where: {
              userId: _userId,
              role: {
                [roleTerm]: true,
              },
            },
          });

          //該当権限を持つロール付与情報が無いなら停止
          if (roleLink === null) {
            return status(401, "Role level not enough");
          }
        },
      };
    },
  });

//URLプレビュー生成
const urlPreviewControl = new Elysia({ name: "urlPreviewControl" })
  .guard({
    body: t.Object({
      channelId: t.String({ minLength: 1 }),
      message: t.String({ minLength: 1 }),
    }),
  })
  .onError(({ error }) => {
    console.error("Middleware :: urlPreviewControl : エラー->", error);
  })
  .macro({
    bindUrlPreview(isEnabled: boolean) {
      return {
        async afterResponse({ server, response }) {
          //URLプレビューが無効あるいはレスポンスが存在しないなら何もしない
          if (!isEnabled || response === undefined || response === null) return;

          //メッセージデータを取得
          const messageData = response.data as Message;
          //メッセージId取り出し
          const messageId = messageData.id;

          //URLを抽出
          const urlRegex: RegExp =
            /https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g;
          const urlMatched = messageData.content.match(urlRegex) ?? [];

          //URLが含まれていないかつ編集された状態じゃないなら何もしない
          if (urlMatched === null && !messageData.isEdited) return;

          //TwitterのリンクがあればfxTwitterへ
          for (const index in urlMatched) {
            if (
              (urlMatched[index].includes("twitter.com") ||
                urlMatched[index].includes("x.com")) &&
              urlMatched[index].includes("status") &&
              !urlMatched[index].includes("fxtwitter.com")
            ) {
              urlMatched[index] = urlMatched[index].replace(
                "twitter.com",
                "fxtwitter.com",
              );
              urlMatched[index] = urlMatched[index].replace(
                "x.com",
                "fxtwitter.com",
              );
            }
          }

          //編集された時用に現在のURLプレビュー情報を削除
          await db.messageUrlPreview.deleteMany({
            where: {
              messageId,
            },
          });

          //URLプレビュー情報取得、格納
          for (const url of urlMatched) {
            await ogs({ url }).then(async (data) => {
              if (data.error) {
                //console.error("Middleware :: urlPreviewControl : URLプレビュー情報取得エラー->", data.error);
                return;
              }

              //メッセージデータにURLプレビュー情報を紐付けしながら変数として保存
              await db.message.update({
                where: {
                  id: messageId,
                },
                data: {
                  MessageUrlPreview: {
                    create: {
                      url: data.result.requestUrl || "",
                      type: data.result.ogType || "UNKNOWN",
                      title: data.result.ogTitle || "",
                      description: data.result.ogDescription || "",
                      faviconLink: data.result.favicon || "",
                      imageLink:
                        data.result.ogImage !== undefined
                          ? data.result.ogImage[0].url
                          : null,
                      videoLink:
                        data.result.ogVideo !== undefined
                          ? data.result.ogVideo[0].url
                          : null,
                    },
                  },
                },
              });
            });
          }

          //現在のメッセージを取得
          const message = await db.message.findUnique({
            where: {
              id: messageId,
            },
            include: {
              MessageUrlPreview: true,
            },
          });
          //WSで通知
          server?.publish(
            `channel::${messageData.channelId}`,
            JSON.stringify({
              signal: "message::UpdateMessage",
              data: message,
            }),
          );
        },
      };
    },
  });

export default CheckToken;
export { checkRoleTerm, urlPreviewControl };
