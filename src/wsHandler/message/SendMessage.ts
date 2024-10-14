import { PrismaClient } from "@prisma/client";
import type { ElysiaWS } from "elysia/dist/ws";
import { z } from "zod";

/**
 * メッセージを送信する
 * @param ws 
 * @param data 
 */
export default async function SendMessage (
  ws: ElysiaWS<any, any, any>,
  data: {
    channelId: string,
    content: string
  },
) {
  try {

    const dataSchema = z.object({
      channelId: z.string(),
      content: z.string(),
    });

    const _data = dataSchema.parse(data);
    const db = new PrismaClient();

    //トークンデータを取得
    const tokenData = await db.token.findUnique({
      where: {
        token: ws.data.cookie.token.value
      }
    });
    if (!tokenData) {
      ws.send({
        signal: "message::SendMessage",
        data: "ERROR :: Internal error"
      });
      return;
    }

    //メッセージデータを作成する
   const messageData = await db.message.create({
      data: {
        channelId: _data.channelId,
        content: _data.content,
        userId: tokenData.userId
      }
    });

    ws.send({
      signal: "message::SendMessage",
      data: messageData
    });
    
    ws.publish("GLOBAL", {
      signal: "message::SendMessage",
      data: messageData
    });

  } catch(e) {

    console.log("SendMessage :: エラー->", e);
    ws.send({
      signal: "message::SendMessage",
      data: "ERROR :: ", e
    });

  }
}