import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm, urlPreviewControl } from "../../Middlewares";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export const server = new Elysia({ prefix: "/server" })
  .get(
    "/config",
    async () => {
      const config = await db.serverConfig.findFirst();
      return {
        message: "Server config fetched",
        data: config,
      };
    },
    {
      detail: {
        description: "サーバーの設定を取得します",
        tags: ["Server"],
      },
    }
  )

  .use(checkRoleTerm)
  .post(
    "/change-info",
    async ({ body: {name, introduction} }) => {
      await db.serverConfig.update({
        where: {
          id: 1,
        },
        data: {
          name,
          introduction,
        },
      });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        introduction: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "サーバーの設定を変更します",
        tags: ["Server"],
      },
      checkRoleTerm: "manageServer"
    }
  )