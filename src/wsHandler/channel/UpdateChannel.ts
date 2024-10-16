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
    description: string,
    isArchive?: boolean
  },
) {
  try {

    const dataSchema = z.object({
      channelId: z.string(),
      name: z.string(),
      description: z.string(),
      isArchived: z.optional(z.boolean())
    });

    const _data = dataSchema.parse(data);
    const db = new PrismaClient();

    //アーカイブの指定があるなら適用
    const optionArchived = _data.isArchived ?
      { isArchived: _data.isArchived }
      :
      null;

    //チャンネルデータを更新する
    const channelDataUpdated = await db.channel.update({
      where: {
        id: _data.channelId
      },
      data: {
        name: _data.name,
        description: _data.description,
        ...optionArchived //アーカイブ指定があるなら適用
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