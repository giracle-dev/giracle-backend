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
    name?: string,
    description?: string,
    isArchived?: boolean
  },
) {
  try {

    const dataSchema = z.object({
      channelId: z.string(),
      name: z.optional(z.string()),
      description: z.optional(z.string()),
      isArchived: z.optional(z.boolean())
    });

    const _data = dataSchema.parse(data);
    const db = new PrismaClient();

    //適用するデータ群のJSON
    const updatingValues: {
      name?: string,
      description?: string,
      isArchived?: boolean
    } = {};

    //渡されたデータを調べて適用するデータを格納
    if (_data.name) updatingValues.name = _data.name;
    if (_data.description) updatingValues.description = _data.description;
    if (_data.isArchived !== undefined) updatingValues.isArchived = _data.isArchived;

    //チャンネルデータを更新する
    const channelDataUpdated = await db.channel.update({
      where: {
        id: _data.channelId
      },
      data: {
        ...updatingValues
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