import { type Channel, PrismaClient } from "@prisma/client";

/**
 * 指定のユーザーが閲覧できるチャンネル情報を取得する
 * @param _userId 
 * @returns 
 */
export default async function GetUserViewableChannel(_userId: string): Promise<Channel[]> {
  //PrismaClientのインスタンスを作成
  const db = new PrismaClient();

  //ユーザーのロールを取得
  const userRolesLinks = await db.roleLink.findMany({
    where: {
      userId: _userId,
    },
    select: {
      roleId: true,
    },
  });
  //ユーザーのロールIdを配列化
  const userRoleIds = userRolesLinks.map((role) => role.roleId);

  //このユーザーが見れるチャンネルIdを取得
  const viewableChannel =await db.channel.findMany({
    where: {
      OR: [
        {
          createdUserId: _userId,
        },
        {
          ChannelViewableRole: {
            some: {
              roleId: {
                in: userRoleIds
              }
            },
          }
        },
        {
          ChannelJoin: {
            some: {
              userId: _userId,
            },
          },
        },
      ],
    },
  }) as Channel[];

  return viewableChannel;
}
