import { PrismaClient } from "@prisma/client";
import type { ElysiaWS } from "elysia/dist/ws";
import { z } from "zod";

/**
 * チャンネル情報を更新する
 * @param ws 
 * @param data 
 */
export default async function UpdateChannel (
  ws: ElysiaWS<any, any, any>,
  data: {
    channelId: string
    name: string,
    description: string
  },
) {
  try {

    const dataSchema = z.object({
      channelId: z.string(),
      name: z.string(),
      description: z.string(),
    });

    const _data = dataSchema.parse(data);
    const db = new PrismaClient();

    //チャンネルデータを更新する
    const channelDataUpdated = await db.channel.update({
      where: {
        id: _data.channelId
      },
      data: {
        name: _data.name,
        description: _data.description
      }
    });

    ws.send({
      signal: "channel::UpdateChannel",
      data: channelDataUpdated
    });
    
    ws.publish("GLOBAL", {
      signal: "channel::UpdateChannel",
      data: channelDataUpdated
    });

  } catch(e) {

    console.log("UpdateChannel :: エラー->", e);
    ws.send({
      signal: "channel::UpdateChannel",
      data: "ERROR :: ", e
    });

  }
}