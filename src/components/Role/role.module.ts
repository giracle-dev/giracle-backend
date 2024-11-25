import { PrismaClient } from "@prisma/client";
import Elysia, { error, t } from "elysia";
import CheckToken, { checkRoleTerm } from "../../Middlewares";
import CompareRoleLevelToRole from "../../Utils/CompareRoleLevelToRole";

const db = new PrismaClient();

export const role = new Elysia({ prefix: "/role" })
  .use(CheckToken)
  .get(
    "/search",
    async ({ query: { name } }) => {
      const roles = await db.roleInfo.findMany({
        where: {
          name: {
            contains: name,
          },
        },
      });

      return {
        message: "Role searched",
        data: roles,
      };
    },
    {
      query: t.Object({
        name: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "ロールを検索します",
        tags: ["Role"],
      },
    },
  )
  .get(
    "/get-info/:id",
    async ({ params: { id } }) => {
      const role = await db.roleInfo.findUnique({
        where: {
          id,
        },
      });
      //ロールが存在しない
      if (!role) {
        throw error(404, "Role not found");
      }

      return {
        message: "Role fetched",
        data: role,
      };
    },
    {
      params: t.Object({
        id: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "ロール情報を取得します",
        tags: ["Role"],
      },
    },
  )

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
    "/update",
    async ({ body: { roleId, roleData }, _userId, server }) => {
      if (roleId === "HOST") throw error(400, "You cannot update HOST role");

      const roleUpdated = await db.roleInfo.update({
        where: {
          id: roleId,
        },
        data: {
          createdUserId: _userId,
          ...roleData,
        },
      });

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({ signal: "role::Updated", data: roleUpdated }),
      );

      return {
        message: "Role updated",
        data: roleUpdated,
      };
    },
    {
      body: t.Object({
        roleId: t.String(),
        roleData: t.Object({
          name: t.String(),
          color: t.String(),
          manageServer: t.Optional(t.Boolean()),
          manageChannel: t.Optional(t.Boolean()),
          manageRole: t.Optional(t.Boolean()),
          manageUser: t.Optional(t.Boolean()),
        }),
      }),
      detail: {
        description: "ロール情報を更新します",
        tags: ["Role"],
      },
      checkRoleTerm: "manageRole",
    },
  )
  .post(
    "/link",
    async ({ body: { userId, roleId }, _userId, server }) => {
      //デフォルトのロールはリンク不可
      if (roleId === "MEMBER" || roleId === "HOST") {
        throw error(400, "You cannot link default role");
      }

      //送信者のロールレベルが足りるか確認
      if (userId !== _userId) {
        if (!(await CompareRoleLevelToRole(_userId, roleId))) {
          throw error(400, "Role level not enough or role not found");
        }
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

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({ signal: "role::Linked", data: { userId, roleId } }),
      );

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
    async ({ body: { userId, roleId }, _userId, server }) => {
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

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({ signal: "role::Unlinked", data: { userId, roleId } }),
      );

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
    async ({ body: { roleId }, _userId, server }) => {
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

      //WSで通知
      server?.publish(
        "GLOBAL",
        JSON.stringify({ signal: "role::Deleted", data: roleId }),
      );

      return {
        message: "Role deleted",
        data: roleId
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
  )
  .get(
    "/list",
    async ({ error }) => {
      const roles = await db.roleInfo.findMany();

      //ロールが存在しない
      if (roles === null) {
        throw error(404, "Roles not found");
      }

      return {
        success: true,
        message: "Role list",
        data: roles,
      };
    },
    {
      detail: {
        description: "ロール情報の一覧を取得します",
        tags: ["Role"],
      },
    },
  );
