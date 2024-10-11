import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";
import CompareRoleLevelToRole from "../../Utils/CompareRoleLevelToRole";

const db = new PrismaClient();

export const role = new Elysia({ prefix: "/role" })
  .use(CheckToken)
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
    async ({ body: { userId, roleId }, _userId }) => {
      //送信者のロールレベルが足りるか確認
      if (!(await CompareRoleLevelToRole(_userId, roleId))) {
        return {
          success: false,
          message: "You cannot link this role",
        };
      }

      //リンク済みか確認
      const checkRoleLinked = await db.roleLink.findFirst({
        where: {
          userId, //指定のユーザーId
          roleId,
        },
      });
      //リンク済みならエラー
      if (checkRoleLinked !== null) {
        return {
          success: false,
          message: "Role already linked",
        };
      }
      
      await db.roleLink.create({
        data: {
          userId, //指定のユーザーId
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
    },
  )
  .post(
    "/unlink",
    async ({ body: { userId, roleId }, _userId }) => {
      //違う人のリンク取り消しなら送信者のロールレベルが足りるか確認
      if (userId !== _userId) {
        //送信者のロールレベルが足りるか確認
        if (!(await CompareRoleLevelToRole(_userId, roleId))) {
          return {
            success: false,
            message: "You cannot link this role",
          };
        }
      }

      await db.roleLink.deleteMany({
        where: {
          userId, //指定のユーザーId
          roleId,
        },
      });

      return {
        success: true,
        message: "Role unlinked",
      };
    },
    {
      body: t.Object({
        userId: t.String({ notEmpty: true }),
        roleId: t.String({ notEmpty: true }),
      }),
    },
  )
  .delete(
    "/delete",
    async ({ body: { roleId }, _userId }) => {
      //送信者のロールレベルが足りるか確認
      if (!(await CompareRoleLevelToRole(_userId, roleId))) {
        return {
          success: false,
          message: "You cannot delete this role",
        };
      }

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
