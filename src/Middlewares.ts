import { Elysia, error } from 'elysia'
import { PrismaClient } from "@prisma/client";
import { errorToResponse } from 'elysia/dist/handler';

const db = new PrismaClient();

const Middlewares = new Elysia({ name: 'CheckToken' })
  .macro(({ onBeforeHandle }) => ({
    logToken() {
      onBeforeHandle((context) => {
        console.log("CheckToken :: logToken : cookie->", context.headers)
      });
    },

    checkToken() {
      onBeforeHandle(async (context) => {
        console.log("CheckToken :: checkToken : cookie->", context.cookie);

        const tokenValue = context.cookie.token.value;
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