import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import CheckToken, {
  compareRoleLevelToRole,
  checkRoleTerm,
} from "../../Middlewares";

const db = new PrismaClient();

export const role = new Elysia({ prefix: "/role" })
  .use(CheckToken)
  //.use(compareRoleLevelToRole)
  .use(checkRoleTerm)
  .put(
    "/create",
    async ({ body: { roleName, rolePower }, _userId }) => {
      const newRole = await db.roleInfo.create({
        data: {
          name: roleName,
          createdUserId: _userId,
          ...rolePower,
        },
      });

      return {
        success: true,
        message: "Role created",
        data: {
          roleId: newRole.id,
        },
      };
    },
    {
      body: t.Object({
        roleName: t.String({ minLength: 1 }),
        rolePower: t.Object({
          manageServer: t.Optional(t.Boolean()),
          manageChannel: t.Optional(t.Boolean()),
          manageRole: t.Optional(t.Boolean()),
          manageUser: t.Optional(t.Boolean()),
        }),
      }),
      checkRoleTerm: "manageRole",
    },
  )
  .post(
    "/link",
    async ({ body: { userId, roleId } }) => {
      await db.roleLink.create({
        data: {
          userId,
          roleId,
        },
      });

      return {
        success: true,
        message: "Role linked",
      };
    },
    {
      body: t.Object({
        userId: t.String({ notEmpty: true }),
        roleId: t.String({ notEmpty: true }),
      }),
      checkRoleTerm: "manageRole",
    }
  )
  .delete(
    "/delete",
    async ({ body: { roleId }, _userId }) => {
      //ユーザーのロール付与情報を全削除
      await db.roleLink.deleteMany({
        where: {
          roleId,
        },
      });
      //ロール情報を削除
      await db.roleInfo.delete({
        where: {
          id: roleId,
        },
      });

      return {
        success: true,
        message: "Role deleted",
      };
    },
    {
      body: t.Object({
        roleId: t.String({ notEmpty: true }),
      }),
      checkRoleTerm: "manageRole",
    },
  )
  .get(
    "/:roleId",
    async ({ params: { roleId }, error }) => {
      const role = await db.roleInfo.findUnique({
        where: {
          id: roleId,
        },
      });

      //ロールが存在しない
      if (role === null) {
        throw error(404, "Role not found");
      }

      return {
        success: true,
        message: "Role info",
        data: role,
      };
    },
    {
      params: t.Object({
        roleId: t.String({ notEmpty: true }),
      }),
    },
  );
