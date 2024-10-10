import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import Middlewares from "../../Middlewares";

const db = new PrismaClient();

export const channel = new Elysia({ prefix: "/channel" })
  .use(Middlewares)
  .put(
    "/create",
    async ({ body: { channelName, description }, cookie: { token }, error }) => {
      const tokenData = await db.token.findUnique({
        where: {
          token: token.value,
        },
      });
      if (tokenData === null) {
        return error(500, {
          success: false,
          message: "Internal Error",
        });
      }

      await db.channel.create({
        data: {
          name: channelName,
          description: description,
          user: {
            connect: {
              id: tokenData.userId,
            },
          }
        }
      });

      return {
        success: true,
        message: "Channel created",
      };
    },
    {
      body: t.Object({
        channelName: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
      }),
      checkToken: true,
    },
  );
