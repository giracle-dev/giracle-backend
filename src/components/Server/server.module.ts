import Elysia, { error, t } from "elysia";
import { checkRoleTerm } from "../../Middlewares";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export const server = new Elysia({ prefix: "/server" })
  .get(
    "/config",
    async () => {
      const config = await db.serverConfig.findFirst();
      return {
        message: "Server config fetched",
        data: { ...config, id: undefined } // idは返さない,
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
    async ({ body: {name, introduction}, server }) => {
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
      server?.publish("GLOBAL", JSON.stringify({
        signal: "server::ConfigUpdate",
        data: { ...serverinfo, id: undefined },
      }));

      return {
        message: "Server config updated",
        data: { ...serverinfo, id: undefined } // idは返さない
      };
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