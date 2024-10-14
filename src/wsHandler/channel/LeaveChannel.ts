import { PrismaClient } from "@prisma/client";
import { ElysiaWS } from "elysia/dist/ws";
import { z } from "zod";

/**
 * チャンネルから脱退する
 * @param ws 
 * @param data 
 */
export default async function LeaveChannel (
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
      include: {
        ChannelJoin: {
          where: {
            channelId: _data.channelId
          }
        }
      }
    });
    if (!userDataUpdation) throw new Error("LeaveChannel :: User not found");
    
    //チャンネル参加データが無いならエラー
    if (userDataUpdation.ChannelJoin.length === 0) {
      throw new Error("LeaveChannel :: You are not in this channel");
    }

    //console.log("LeaveChannel :: 適用するデータ->", _data);

    await db.channelJoin.delete({
      where: {
        userId_channelId: {
          channelId: _data.channelId,
          userId: userDataUpdation.id
        }
      }
    });

    ws.send({
      signal: "channel::LeaveChannel",
      data: {
        userId: userDataUpdation.id,
        channelId: _data.channelId
      }
    });
    
    ws.publish("GLOBAL", {
      signal: "channel::LeaveChannel",
      data: {
        userId: userDataUpdation.id,
        channelId: _data.channelId
      }
    });

    db.$disconnect();

  } catch(e) {

    console.log("JoinChannel :: エラー->", e);
    ws.send({
      signal: "channel::JoinChannel",
      data: "ERROR :: ", e
    });

  }
}
