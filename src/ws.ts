import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";

/**
 * WebSocket用 ハンドラ
 */
export const wsHandler = new Elysia()
  .ws("/ws",
    {
      body: t.Object({
        signal: t.Literal("subscribeChannel"),
        channelId: t.String({ minLength: 1 }),
      }),
      query: t.Object({
        token: t.Optional(t.String({ minLength: 1 })),
      }),

      message(ws, data) {
        console.log("ws :: message : メッセージ受信", data);
        
        ws.subscribe(`channel::${data.channelId}`);
      },

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

        console.log("ws :: WS接続 :: token ->", token);

        const db = new PrismaClient();
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

        console.log("index :: 新しいWS接続");
      },

      close(ws) {
        console.log("ws :: WS切断");
      },
  })
