import { PrismaClient } from "@prisma/client";
import Elysia, { status, t } from "elysia";
import CheckToken from "../../Middlewares";

const db = new PrismaClient();

export const notification = new Elysia({ prefix: "/notification" })
  .use(CheckToken)
  .post(
    "/register-device",
    async ({ body: { deviceToken, platform }, _userId }) => {
      // 既存のデバイストークンを確認
      const existingToken = await db.deviceToken.findUnique({
        where: { deviceToken: deviceToken },
      });

      if (existingToken) {
        // 既存トークンが同じユーザーの場合は更新
        if (existingToken.userId === _userId) {
          const updatedToken = await db.deviceToken.update({
            where: { deviceToken: deviceToken },
            data: {
              isActive: true,
              updatedAt: new Date(),
            },
          });

          return {
            message: "Device token updated",
            data: updatedToken,
          };
        }

        // 別のユーザーのトークンの場合は古いものを無効化して新規作成
        await db.deviceToken.update({
          where: { deviceToken: deviceToken },
          data: { isActive: false },
        });
      }

      // 新規デバイストークンを登録
      const newToken = await db.deviceToken.create({
        data: {
          deviceToken: deviceToken,
          platform: platform,
          userId: _userId,
          isActive: true,
        },
      });

      return {
        message: "Device token registered",
        data: newToken,
      };
    },
    {
      body: t.Object({
        deviceToken: t.String({ minLength: 1 }),
        platform: t.Union([t.Literal("ios"), t.Literal("android")]),
      }),
      detail: {
        description: "デバイストークンを登録します（iOS/Android）",
        tags: ["Notification"],
      },
    }
  )
  .delete(
    "/unregister-device",
    async ({ body: { deviceToken }, _userId }) => {
      // デバイストークンの存在確認
      const existingToken = await db.deviceToken.findUnique({
        where: { deviceToken: deviceToken },
      });

      if (!existingToken) {
        return status(404, {
          message: "Device token not found",
        });
      }

      // 自分のトークンでない場合はエラー
      if (existingToken.userId !== _userId) {
        return status(403, {
          message: "You cannot unregister another user's device token",
        });
      }

      // デバイストークンを無効化（削除ではなく無効化）
      await db.deviceToken.update({
        where: { deviceToken: deviceToken },
        data: { isActive: false },
      });

      return {
        message: "Device token unregistered",
      };
    },
    {
      body: t.Object({
        deviceToken: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "デバイストークンの登録を解除します",
        tags: ["Notification"],
      },
    }
  )
  .get(
    "/my-devices",
    async ({ _userId }) => {
      // ユーザーのアクティブなデバイストークンを取得
      const devices = await db.deviceToken.findMany({
        where: {
          userId: _userId,
          isActive: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return {
        message: "Device tokens retrieved",
        data: devices,
      };
    },
    {
      detail: {
        description: "自分の登録済みデバイスを取得します",
        tags: ["Notification"],
      },
    }
  )
  .patch(
    "/settings",
    async ({ body: { notificationMode }, _userId }) => {
      // ユーザーのすべてのアクティブなデバイストークンを更新
      const updatedDevices = await db.deviceToken.updateMany({
        where: {
          userId: _userId,
          isActive: true,
        },
        data: {
          notificationMode: notificationMode,
        },
      });

      return {
        message: "Notification settings updated",
        data: {
          updatedCount: updatedDevices.count,
          notificationMode: notificationMode,
        },
      };
    },
    {
      body: t.Object({
        notificationMode: t.Union([
          t.Literal("all"),
          t.Literal("mentions"),
          t.Literal("off"),
        ]),
      }),
      detail: {
        description: "通知設定を更新します（all/mentions/off）",
        tags: ["Notification"],
      },
    }
  );
