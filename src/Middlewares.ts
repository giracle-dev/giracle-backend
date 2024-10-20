import { type Message, PrismaClient } from "@prisma/client";
import { Elysia, error, t } from "elysia";
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
      return error(401, "Invalid token");
    }

    //トークンがDBにあるか確認
    const tokenData = await db.token.findUnique({
      where: {
        token: token.value,
      },
    });

    if (tokenData === null) {
      return error(401, "Invalid token");
    }

    return {
      _userId: tokenData.userId,
    };
  });

const checkRoleTerm = new Elysia({ name: "checkRoleTerm" })
  .use(CheckToken)
  .macro(({ onBeforeHandle }) => ({
    async checkRoleTerm(roleTerm: string) {
      onBeforeHandle(async ({ _userId }) => {
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
          return error(401, "Role level not enough");
        }
      });
    },
  }));

//URLプレビューを操作するミドルウェア
const urlPreviewControl = new Elysia({ name: "addUrlPreview" })
  .guard({
    body: t.Object({
      channelId: t.String({ minLength: 1 }),
      message: t.String({ minLength: 1 }),
    }),
    response: t.Object({
      message: t.Literal("Message sent"),
      data: t.Object({
        id: t.String({ minLength: 1 }),
        channelId: t.String({ minLength: 1 }),
        userId: t.String({ minLength: 1 }),
        content: t.String({ minLength: 1 }),
        createdAt: t.String({ minLength: 1 }),
        updatedAt: t.String({ minLength: 1 }),
      }),
    }),
  })
  .macro(({ onAfterResponse }) => {
    return {
      async bindUrlPreview(isEnabled: boolean) {
        onAfterResponse(async ({ body, server, response }) => {
          //URLプレビューが無効あるいはレスポンスが存在しないなら何もしない
          if (!isEnabled || response === undefined) return;
          //メッセージId取り出し
          const messageId = response.data.id;

          //URLを抽出
          const urlRegex: RegExp =
            /https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g;
          const urlMatched = body.message.match(urlRegex);
          //URLが含まれていないなら何もしない
          if (urlMatched === null) return;

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
                    },
                  },
                },
              });
            });
          }

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
            `channel::${body.channelId}`,
            JSON.stringify({
              signal: "message::UpdateMessage",
              data: message,
            }),
          );
        });
      },
    };
  });

export default CheckToken;
export { checkRoleTerm, urlPreviewControl };
