import { PrismaClient } from "@prisma/client";

/**
 * ユーザーのロールレベルを取得する関数
 * @param _userId
 */
export default async function getUsersRoleLevel(
  _userId: string,
): Promise<number> {
  const db = new PrismaClient();

  //ユーザー情報を付与されたロールと同時に取得
  const userWithRoles = await db.user.findUnique({
    where: {
      id: _userId,
    },
    include: {
      RoleLink: {
        include: {
          role: true,
        },
      },
    },
  });
  //ユーザーが存在しない場合はfalseを返す
  if (userWithRoles === null) return 0;

  //送信者のロールレベル用変数
  let userRoleLevel = 0;
  //送信者のロール分ループしてレベルを計算(高ければ格納)
  for (const roleData of userWithRoles.RoleLink) {
    if (roleData.role.manageServer) {
      //管理者権限を持つユーザーなら問答無用でtrueを返す
      userRoleLevel = 5;
      break;
    }

    if (roleData.role.manageRole && userRoleLevel < 4) {
      userRoleLevel = 4;
      continue;
    }
    if (roleData.role.manageUser && userRoleLevel < 3) {
      userRoleLevel = 3;
      continue;
    }
    if (roleData.role.manageChannel && userRoleLevel < 2) {
      userRoleLevel = 2;
    }
  }

  return userRoleLevel;
}
