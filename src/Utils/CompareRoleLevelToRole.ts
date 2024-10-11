import { PrismaClient } from "@prisma/client";

const levelIndex = {
  manageServer: 5,
  manageChannel: 2,
  manageRole: 4,
  manageUser: 3,
};

/**
 * 操作者と対象のロールレベルを比較する関数
 * @param _userId - 操作者のユーザーID
 * @param _roleId - 対象のロールID
 * @returns boolean - 操作者のロールレベルが、対象ロールより高いか等しい場合はtrueを返す
 */
export default async function CompareRoleLevelToRole(
  _userId: string,
  _roleId: string,
): Promise<boolean> {
  //HOSTロールに対する操作は許可しない
  if (_roleId === "HOST") return false;

  const db = new PrismaClient();
  //送信者のユーザー情報を付与されたロールと同時に取得
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
  if (userWithRoles === null) return false;

  //対象のロール情報を取得
  const role = await db.roleInfo.findUnique({
    where: {
      id: _roleId,
    },
  });
  //対象ロールが見つからなかったらfalseを返す
  if (role === null) return false;

  //送信者のロールレベル用変数
  let userRoleLevel = 0;
  //送信者のロール分ループしてレベルを計算(高ければ格納)
  for (const roleData of userWithRoles.RoleLink) {
    if (roleData.role.manageServer) {
      //管理者権限を持つユーザーなら問答無用でtrueを返す
      userRoleLevel = 5;
      return true;
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


  //対象のロールのレベル用変数
  let targetRoleLevel = 0;
  //対象のロールのレベルを計算(高ければ格納)
  if (role.manageServer) {
    targetRoleLevel = 5;
  }
  if (role.manageRole && targetRoleLevel < 4) {
    targetRoleLevel = 4;
  }
  if (role.manageUser && targetRoleLevel < 3) {
    targetRoleLevel = 3;
  }
  if (role.manageChannel && targetRoleLevel < 2) {
    targetRoleLevel = 2;
  }

  console.log(
    "compareRoleLevelToRole :: userRoleLevel->",
    userRoleLevel,
    " targetRoleLevel->",
    targetRoleLevel,
  );

  //送信者のロールレベルが高いか等しい場合はtrueを返す
  return userRoleLevel >= targetRoleLevel;
}
