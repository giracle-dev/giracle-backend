import { Elysia, error, t } from 'elysia'
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

//ユーザーIdをトークンに紐付けるためだけのMap
const userIdPassing = new Map<string, string>();

const CheckToken = new Elysia({ name: 'CheckToken' })
  .guard({
    cookie: t.Object({token: t.String()})
  })
  .resolve({ as: "scoped"}, async ({cookie: {token}}) => {
     //トークンがDBにあるか確認
     const tokenData = await db.token.findUnique({
        where: {
          token: token.value
        }
      });

      if (tokenData === null) { return error(401, "Invalid token"); }

    return {
      _userId: tokenData?.userId
    };
  });

const compareRoleLevelToRole = new Elysia({ name: 'compareRoleLevelToRole' })
  .use(CheckToken)
  .macro(
    ({onBeforeHandle}) => ({
      async compareRoleLevelToRole(dat:{targetRoleId: string}, { _userId }) {
        //ユーザーとロール情報取得
        const userWithRoles = await db.user.findUnique({
          where: {
            id: _userId
          },
          include: {
            RoleLink: true
          }
        });

        const role = await db.roleInfo.findUnique({
          where: {
            id: dat.targetRoleId
          }
        });

        if (role === null) {
          return error(404, "Role not found");
        }

        console.log("compareRoleLevelToRole :: triggered");
      }
    })
  );

const checkRoleTerm = new Elysia({ name: 'checkRoleTerm' })
  .use(CheckToken)
  .macro(
    ({ onBeforeHandle }) => ({
    async checkRoleTerm(roleTerm: string) {
      onBeforeHandle(async ({cookie: token, _userId}) => {
        console.log("送信者のロールId->", _userId);

        //該当権限を持つロール付与情報を検索
        const roleLink = await db.roleLink.findFirst({
          where: {
            userId: _userId,
            role: {
              [roleTerm]: true
            }
          }
        });

        //該当権限を持つロール付与情報が無いなら停止
        if (roleLink === null) {
          return error(401, "Role level not enough");
        }
      });
    }
    })
  );

export default CheckToken;
export { compareRoleLevelToRole, checkRoleTerm };