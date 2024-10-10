import Elysia, { t } from "elysia";
import CheckToken, { compareRoleLevelToRole, checkRoleTerm } from "../../Middlewares";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export const role = new Elysia({ prefix: "/role" })
  .use(CheckToken)
  .use(compareRoleLevelToRole)
  .use(checkRoleTerm)
  .put(
    "/create",
    async ({ body: { roleName, rolePower }, _userId }) => {
      const newRole = await db.roleInfo.create({
        data: {
          name: roleName,
          createdUserId: _userId,
          ...rolePower
        }
      });

      return {
        success: true,
        message: "Role created",
        data: {
          roleId: newRole.id
        }
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
        })
      }),
      _userId: t.String({ minLength: 2 }),
      checkRoleTerm: "manageRole",
    },
  )
  .delete(
    "/delete",
    async ({ body: { roleId }, _userId }) => {
      await db.roleInfo.delete({
        where: {
          id: roleId
        }
      });

      return {
        success: true,
        message: "Role deleted"
      }
    },
    {
      body: t.Object({
        roleId: t.String({ notEmpty: true }),
      }),
      checkRoleTerm: "manageRole",
    }
  )
  .get(
    "/:roleId",
    async ({ params: { roleId }, _userId, error }) => {
      const role = await db.roleInfo.findUnique({
        where: {
          id: roleId
        }
      });

      //ロールが存在しない
      if (role === null) {
        throw error(404, "Role not found");
      }

      return {
        success: true,
        message: "Role info",
        data: role
      }
    },
    {
      params: t.Object({
        roleId: t.String({ notEmpty: true }),
      }),
      checkToken: true,
    }
  );