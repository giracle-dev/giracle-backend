import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import CheckToken from "../../Middlewares";

const db = new PrismaClient();

export const channel = new Elysia({ prefix: "/channel" })
  .use(CheckToken)
  .put(
    "/create",
    async ({ body: { channelName, description }, _userId }) => {
      await db.channel.create({
        data: {
          name: channelName,
          description: description,
          user: {
            connect: {
              id: _userId,
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
    },
  );
