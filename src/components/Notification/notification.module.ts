import { Elysia, t, status } from 'elysia';
import { PrismaClient } from '@prisma/client';
import CheckToken from '../../Middlewares';

const db = new PrismaClient();

export const notification = new Elysia({ prefix: '/notification' })
  .use(CheckToken)

  // デバイストークン登録
  .post(
    '/device-token/register',
    async ({ body: { token, platform, deviceName }, _userId }) => {
      console.log(`📱 Registering device token for user ${_userId}`);
      console.log(`   Platform: ${platform}`);
      console.log(`   Device: ${deviceName || 'Unknown'}`);

      // 既存トークンがあれば更新、なければ新規作成
      const existingToken = await db.deviceToken.findUnique({
        where: { token },
      });

      if (existingToken) {
        console.log(`   → Updating existing token`);
        await db.deviceToken.update({
          where: { token },
          data: {
            userId: _userId,
            platform,
            deviceName,
            updatedAt: new Date(),
          },
        });
      } else {
        console.log(`   → Creating new token`);
        await db.deviceToken.create({
          data: {
            userId: _userId,
            token,
            platform,
            deviceName,
          },
        });
      }

      console.log(`✅ Device token registered successfully`);

      return { message: 'Device token registered' };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        platform: t.Union([
          t.Literal('ios'),
          t.Literal('android'),
          t.Literal('web'),
        ]),
        deviceName: t.Optional(t.String()),
      }),
      detail: {
        description: 'デバイストークンを登録',
        tags: ['Notification'],
      },
    }
  )

  // デバイストークン削除
  .delete(
    '/device-token/:token',
    async ({ params: { token }, _userId }) => {
      console.log(`🗑️ Deleting device token: ${token.substring(0, 10)}...`);

      const deviceToken = await db.deviceToken.findUnique({
        where: { token },
      });

      if (!deviceToken) {
        return status(404, 'Device token not found');
      }

      // 自分のトークンのみ削除可能
      if (deviceToken.userId !== _userId) {
        return status(403, 'Forbidden');
      }

      await db.deviceToken.delete({
        where: { token },
      });

      console.log(`✅ Device token deleted`);

      return { message: 'Device token deleted' };
    },
    {
      params: t.Object({
        token: t.String({ minLength: 1 }),
      }),
      detail: {
        description: 'デバイストークンを削除',
        tags: ['Notification'],
      },
    }
  )

  // 通知設定取得
  .get(
    '/settings',
    async ({ _userId }) => {
      console.log(`⚙️ Getting notification settings for user ${_userId}`);

      let settings = await db.notificationSetting.findUnique({
        where: { userId: _userId },
      });

      // 設定がなければデフォルト作成
      if (!settings) {
        console.log(`   → Creating default settings`);
        settings = await db.notificationSetting.create({
          data: { userId: _userId },
        });
      }

      return {
        message: 'Notification settings',
        data: settings,
      };
    },
    {
      detail: {
        description: '通知設定を取得',
        tags: ['Notification'],
      },
    }
  )

  // 通知設定更新
  .patch(
    '/settings',
    async ({ body, _userId }) => {
      console.log(`⚙️ Updating notification settings for user ${_userId}`);
      console.log(`   Updates:`, body);

      const settings = await db.notificationSetting.upsert({
        where: { userId: _userId },
        update: body,
        create: {
          userId: _userId,
          ...body,
        },
      });

      console.log(`✅ Notification settings updated`);

      return {
        message: 'Notification settings updated',
        data: settings,
      };
    },
    {
      body: t.Object({
        enableMention: t.Optional(t.Boolean()),
        enableReaction: t.Optional(t.Boolean()),
        enableMessage: t.Optional(t.Boolean()),
        enableSystem: t.Optional(t.Boolean()),
      }),
      detail: {
        description: '通知設定を更新',
        tags: ['Notification'],
      },
    }
  )

  // デバイストークン一覧取得（デバッグ用）
  .get(
    '/device-tokens',
    async ({ _userId }) => {
      const tokens = await db.deviceToken.findMany({
        where: { userId: _userId },
        select: {
          id: true,
          platform: true,
          deviceName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Device tokens',
        data: tokens,
      };
    },
    {
      detail: {
        description: '登録済みデバイストークン一覧を取得',
        tags: ['Notification'],
      },
    }
  );
