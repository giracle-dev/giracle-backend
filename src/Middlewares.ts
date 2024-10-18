import { PrismaClient } from "@prisma/client";
import { Elysia, error, t } from "elysia";

const db = new PrismaClient();

const CheckToken = new Elysia({ name: "CheckToken" })
  .guard({
    cookie: t.Object(
      { token: t.String({ minLength: 1}) },
      { error: "Cookie for token is not valid." }
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
  .macro(({ onAfterHandle }) => {
    return {
      async bindUrlPreview(isEnabled = false) {
        onAfterHandle(async ({ response }) => {
          //URLプレビューが無効なら何もしない
          if (!isEnabled) return;

          console.log("Middleware :: urlPreviewControl : URLプレビューします");
        });
      }
    }
  });

export default CheckToken;
export { checkRoleTerm, urlPreviewControl };
