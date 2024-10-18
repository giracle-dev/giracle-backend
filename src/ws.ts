import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import type { ElysiaWS } from "elysia/dist/ws";

const db = new PrismaClient();
//ユーザーごとのWSインスタンス管理
export const userWSInstance = new Map<string, ElysiaWS<any, any, any>>();

/**
 * WebSocket用 ハンドラ
 */
export const wsHandler = new Elysia()
  .ws("/ws",
    {
      body: t.Object({
        signal: t.Literal("subscribeChannel"),
        data: t.String({ minLength: 1 }),
      }),
      query: t.Object({
        token: t.Optional(t.String({ minLength: 1 })),
      }),

      async open(ws) {
        //トークンを取得して有効か調べる
        const token = ws.data.cookie.token.value || ws.data.query.token;
        if (!token) {
          console.log("ws :: WS接続 :: token not valid");
          ws.send({
            signal: "ERROR",
            data: "token not valid",
          });
          ws.close();
          return;
        }

        const user = await db.user.findFirst({
          where: {
            Token: {
              some: {
                token: token,
              },
            },
          },
          include: {
            ChannelJoin: true,
          }
        });
        if (!user) {
          console.log("ws :: WS接続 :: user not found");
          ws.send({
            signal: "ERROR",
            data: "token not valid",
          });
          ws.close();
          return
        }

        //ハンドラのリンク
        ws.subscribe(`user::${user.id}`);
        ws.subscribe("GLOBAL");
        //チャンネル用ハンドラのリンク
        for (const channelData of user.ChannelJoin) {
          ws.subscribe(`channel::${channelData.channelId}`);
        }

        //このユーザーWSインスタンス保存
        userWSInstance.set(user.id, ws);

        console.log("index :: 新しいWS接続");
      },

      close(ws) {
        console.log("ws :: WS切断");
      },
  })
