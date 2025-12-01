/**
 * ロールのデータそのものからロールレベルを計算して返す
 * @param role ロール情報
 * @returns ロールレベル
 */
export default function CalculateRoleLevel (
  rolePower: {
    manageServer?: boolean;
    manageChannel?: boolean;
    manageUser?: boolean;
    manageRole?: boolean;
    manageEmoji?: boolean;
  }
): number {
  if (rolePower.manageServer !== undefined && rolePower.manageServer) {
    return 5;
  }
  if (rolePower.manageRole !== undefined && rolePower.manageRole) {
    return 4;
  }
  if (rolePower.manageUser !== undefined && rolePower.manageUser) {
    return 3;
  }
  if (rolePower.manageChannel !== undefined && rolePower.manageChannel) {
    return 2;
  }
  if (rolePower.manageEmoji !== undefined && rolePower.manageEmoji) {
    return 1;
  }

  return 0;
}