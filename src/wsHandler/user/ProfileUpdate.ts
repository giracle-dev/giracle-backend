import { PrismaClient } from "@prisma/client";
import { ElysiaWS } from "elysia/dist/ws";
import { z } from "zod";

/**
 * プロフィールを更新する
 * @param ws 
 * @param data 
 */
export default async function ProfileUpdate (
  ws: ElysiaWS<any, any, any>,
  data: {name?:string, selfIntroduction?:string},
) {
  try {

    const dataSchema = z.object({
      name: z.optional(z.string()),
      selfIntroduction: z.optional(z.string()),
    });

    const _data = dataSchema.parse(data)
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
    if (!userDataUpdation) throw new Error("ProfileUpdate :: User not found");

    //console.log("ProfileUpdate :: 適用するデータ->", _data);

    //データ更新
    const userUpdated = await db.user.update({
      where: {
        id: userDataUpdation.id,
      },
      data: _data,
    });

    
    ws.send({
      signal: "user::profileUpdate",
      data: userUpdated
    });
    
    ws.publish("GLOBAL", {
      signal: "user::profileUpdate",
      data: userUpdated
    });

    db.$disconnect();

  } catch(e) {

    console.log("ProfileUpdate :: エラー->", e);
    ws.send({
      signal: "user::profileUpdate",
      data: "ERROR"
    });

  }
}