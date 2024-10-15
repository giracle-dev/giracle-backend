import { PrismaClient } from "@prisma/client";
import type { ElysiaWS } from "elysia/dist/ws";
import { z } from "zod";

/**
 * チャンネルへ参加する
 * @param ws 
 * @param data 
 */
export default async function JoinChannel (
  ws: ElysiaWS<any, any, any>,
  data: {
    channelId?: string
  },
) {
  try {

    const dataSchema = z.object({
      channelId: z.string()
    });

    const _data = dataSchema.parse(data);
    const db = new PrismaClient();

    const userDataUpdation = await db.user.findFirst({
      where: {
        Token: {
          some: {
            token: ws.data.cookie.token.value,
          },
        },
      },
    });
    if (!userDataUpdation) throw new Error("JoinChannel :: User not found");

    console.log("JoinChannel :: 適用するデータ->", _data);

    const channelJoin = await db.channelJoin.create({
      data: {
        channelId: _data.channelId,
        userId: userDataUpdation.id
      }
    });

    ws.send({
      signal: "channel::JoinChannel",
      data: channelJoin
    });
    
    ws.publish("GLOBAL", {
      signal: "channel::JoinChannel",
      data: channelJoin
    });

    db.$disconnect();

  } catch(e) {

    console.log("JoinChannel :: エラー->", e);
    ws.send({
      signal: "channel::JoinChannel",
      data: "ERROR"
    });

  }
}
