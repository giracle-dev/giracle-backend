import { Elysia, error } from 'elysia'
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CheckToken = new Elysia({ name: 'CheckToken' })
  .derive({ as: "scoped"}, async ({ cookie: { token } }) => {
    //クッキーが無いなら停止
    if (token.value === undefined) {
      return {
        _userId: ""
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
      _userId: tokenData.userId
    }
  })

export default CheckToken;