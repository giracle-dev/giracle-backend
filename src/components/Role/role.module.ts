import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
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
      detail: {
        description: "ロールを作成します",
        tags: ["Role"],
      },
      checkRoleTerm: "manageRole",
    },
  )
  .post(
    "/link",
    async ({ body: { userId, roleId }, _userId }) => {
      //送信者のロールレベルが足りるか確認
      if (!(await CompareRoleLevelToRole(_userId, roleId))) {
        throw error(400, "Role level not enough or role not found");
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
        throw error(400, "Role already linked");
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
      detail: {
        description: "ユーザーにロールを付与します",
        tags: ["Role"],
      },
      checkRoleTerm: "manageRole",
    },
  )
  .post(
    "/unlink",
    async ({ body: { userId, roleId }, _userId }) => {
      //デフォルトのロールはリンク取り消し不可
      if (roleId === "MEMBER" || roleId === "HOST") {
        throw error(400, "You cannot unlink default role");
      }

      //送信者のロールレベルが足りるか確認
      if (!(await CompareRoleLevelToRole(_userId, roleId))) {
        throw error(400, "Role level not enough or role not found");
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
      detail: {
        description: "ユーザーからロールを剥奪します",
        tags: ["Role"],
      },
    },
  )
  .delete(
    "/delete",
    async ({ body: { roleId }, _userId }) => {
      //送信者のロールレベルが足りるか確認
      if (!(await CompareRoleLevelToRole(_userId, roleId))) {
        throw error(400, "Role level not enough or role not found");
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
      detail: {
        description: "ロールを削除します",
        tags: ["Role"],
      },
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
      detail: {
        description: "ロール情報を取得します",
        tags: ["Role"],
      },
    },
  );
