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
      body: t.Object({
        signal: t.String({ minLength: 1 }),
        data: t.Any(),
      }),

      message(ws, message) {
        console.log("ws :: メッセージ受信 ::", message);
        if (message.signal === "ping") {
          ws.send("pong");
        }

        //シグナル名に合わせた処理分岐
        if (message.signal.startsWith("user")) UserHandler(ws, message.signal, message.data);
        if (message.signal.startsWith("channel")) ChannelHandler(ws, message.signal, message.data);
        if (message.signal.startsWith("message")) MessageHandler(ws, message.signal, message.data);
      },

      async open(ws) {
        const token = ws.data.cookie.token.value;
        if (!token) {
          console.log("ws :: WS接続 :: token not valid");
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
          ws.close();
          return
        }

        //ハンドラのリンク
        ws.subscribe(user.id);
        ws.subscribe("GLOBAL");
        //チャンネル用ハンドラのリンク
        for (const channelData of user.ChannelJoin) {
          ws.subscribe(`channel::${channelData.channelId}`);
        }

        ws.send("connect complted");

        console.log("index :: 新しいWS接続");
      },
      close(ws) {
        console.log("ws :: WS切断");
      },
  })
