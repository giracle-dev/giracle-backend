import { Elysia, error } from 'elysia'
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const Middlewares = new Elysia({ name: 'CheckToken' })
  .derive({ as: "scoped"}, async ({ cookie: { token } }) => {
    //クッキーが無いなら停止
    if (token.value === undefined) {
      return {
        userId: ""
      }
    }

    //トークンがDBにあるか確認
    const tokenData = await db.token.findUnique({
      where: {
        token: token.value
      }
    });
    //トークンが無いなら停止
    if (tokenData === null) {
      throw error(401, "Token is invalid");
    }

    return {
      userId: tokenData.userId
    }
  })
  .macro(({ onBeforeHandle }) => ({
    logToken() {
      onBeforeHandle((context) => {
        console.log("CheckToken :: logToken : cookie->", context.headers)
      });
    },

    checkToken() {
      onBeforeHandle(async ({cookie, userId}) => {
        //console.log("CheckToken :: checkToken : cookie->", context.cookie);

        const tokenValue = cookie.token.value;
        if (tokenValue === undefined) {
          throw error(401, "Token is invalid");
        }

        const tokenData = await db.token.findUnique({
          where: {
            token: tokenValue
          }
        });

        if (tokenData === null) {
          throw error(401, "Token is invalid");
        }
      });
    },
  }));

export default Middlewares;