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
  data: {name?:string, description?:string},
) {
  try {

    const dataSchema = z.object({
      name: z.optional(z.string()),
      description: z.optional(z.string()),
    });

    const _data = dataSchema.parse(data)
    const db = new PrismaClient();

    //データの更新用オブジェクト
    const dataNew: {name?:string, description?:string} = {};
    //更新するデータを格納
    if (_data.name) dataNew["name"] = _data.name;
    if (_data.description) dataNew["description"] = _data.description;

    //データ更新
    const userUpdated = await db.user.updateMany({
      where: {
        Token: {
          some: {
            token: ws.data.cookie.token.value,
          },
        }
      },
      data: _data,
    });

    ws.send({
      signal: "user::profileUpdate::success",
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