import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import UserHandler from "./wsHandler/user.ws";
import ChannelHandler from "./wsHandler/channel.ws";
import MessageHandler from "./wsHandler/message.ws";

/**
 * WebSocket用 ハンドラ
 */
export const wsHandler = new Elysia()
  .ws("/ws",
    {
      body: t.Optional(t.Object({
        signal: t.String({ minLength: 1 }),
        data: t.Any(),
      })),
      query: t.Object({
        token: t.String({ minLength: 1 }),
      }),

      message(ws, message) {
        if (message?.signal === undefined) {
          return;
        }
        console.log("ws :: メッセージ受信 ::", message);
        if (message?.signal === "ping") {
          ws.send("pong");
        }

        //シグナル名に合わせた処理分岐
        switch (true) {
          case message.signal.startsWith("user"):
            UserHandler(ws, message?.signal, message.data);
            break;
          case message.signal.startsWith("channel"):
            ChannelHandler(ws, message.signal, message.data);
            break;
          case message.signal.startsWith("message"):
            MessageHandler(ws, message.signal, message.data);
            break;
          default:
            console.log("ws :: 未知のシグナル ::", message);
        }
      },

      async open(ws) {
        console.log("ws :: WS接続 :: ぱらめーた", ws.data.query.token);
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
