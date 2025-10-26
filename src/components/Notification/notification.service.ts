import apn from 'apn';
import { db } from '../../index';

// APNs設定の検証
const isAPNsConfigured = Boolean(
  Bun.env.APNS_KEY_ID &&
  Bun.env.APNS_TEAM_ID &&
  Bun.env.APNS_KEY_PATH &&
  Bun.env.APNS_TOPIC
);

// APNs Provider初期化（サーバー起動時に1回だけ）
let apnProvider: apn.Provider | null = null;

if (isAPNsConfigured) {
  try {
    apnProvider = new apn.Provider({
      token: {
        key: Bun.env.APNS_KEY_PATH!,
        keyId: Bun.env.APNS_KEY_ID!,
        teamId: Bun.env.APNS_TEAM_ID!,
      },
      production: Bun.env.APNS_PRODUCTION === 'true',
    });

    console.log('✅ APNs Provider initialized');
    console.log('   Production mode:', Bun.env.APNS_PRODUCTION === 'true');
    console.log('   Key ID:', Bun.env.APNS_KEY_ID);
    console.log('   Team ID:', Bun.env.APNS_TEAM_ID);
    console.log('   Topic:', Bun.env.APNS_TOPIC);
  } catch (error) {
    console.error('❌ Failed to initialize APNs Provider:', error);
    apnProvider = null;
  }
} else {
  console.warn('⚠️ APNs is NOT configured (push notifications disabled)');
  console.warn('   Please set the following environment variables:');
  console.warn('   - APNS_KEY_ID');
  console.warn('   - APNS_TEAM_ID');
  console.warn('   - APNS_KEY_PATH');
  console.warn('   - APNS_TOPIC');
  console.warn('   See documentation for setup instructions.');
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

export class NotificationService {
  /**
   * 特定ユーザーにプッシュ通知を送信
   */
  async sendToUser(userId: string, payload: NotificationPayload) {
    try {
      // 1. ユーザーの通知設定を確認
      const settings = await db.notificationSetting.findUnique({
        where: { userId },
      });

      if (!settings) {
        console.log(`⚠️ No notification settings for user ${userId}, creating default...`);
        // デフォルト設定を作成
        await db.notificationSetting.create({
          data: { userId },
        });
      }

      // 2. デバイストークンを取得（iOSのみ）
      const tokens = await db.deviceToken.findMany({
        where: {
          userId,
          platform: 'ios',
        },
      });

      if (tokens.length === 0) {
        console.log(`📱 No device tokens found for user ${userId}`);
        return;
      }

      console.log(`📤 Sending notification to ${tokens.length} device(s) for user ${userId}`);

      // 3. 各デバイスに送信
      const results = [];
      for (const deviceToken of tokens) {
        try {
          await this.sendAPNs(deviceToken.token, payload);
          console.log(`✅ Notification sent to ${deviceToken.deviceName || 'device'}`);
          results.push({ success: true, device: deviceToken.deviceName });
        } catch (error: any) {
          console.error(`❌ Failed to send notification to ${deviceToken.deviceName}:`, error);

          // トークンが無効な場合は削除
          if (error.reason === 'BadDeviceToken' || error.reason === 'Unregistered') {
            await db.deviceToken.delete({
              where: { id: deviceToken.id },
            });
            console.log(`🗑️ Removed invalid token for ${deviceToken.deviceName}`);
          }

          results.push({ success: false, device: deviceToken.deviceName, error: error.reason });
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error in sendToUser:', error);
      throw error;
    }
  }

  /**
   * APNs経由で送信
   */
  private async sendAPNs(token: string, payload: NotificationPayload) {
    // APNsが設定されていない場合はスキップ
    if (!apnProvider) {
      console.warn('⚠️ APNs not configured, skipping push notification');
      return;
    }

    const notification = new apn.Notification();

    // 通知内容
    notification.alert = {
      title: payload.title,
      body: payload.body,
    };

    // バッジ数（アプリアイコンの赤い数字）
    notification.badge = payload.badge || 0;

    // 通知音
    notification.sound = payload.sound || 'default';

    // アプリのBundle ID
    notification.topic = Bun.env.APNS_TOPIC || '';

    // カスタムデータ（タップ時に使用）
    notification.payload = payload.data || {};

    // 有効期限（24時間）
    notification.expiry = Math.floor(Date.now() / 1000) + 3600 * 24;

    // 送信
    const result = await apnProvider.send(notification, token);

    // エラーチェック
    if (result.failed.length > 0) {
      const failure = result.failed[0];
      throw {
        reason: failure.response?.reason,
      };
    }

    return result;
  }

  /**
   * チャンネルのメンバー全員に送信
   */
  async sendToChannelMembers(
    channelId: string,
    excludeUserId: string | null,
    payload: NotificationPayload
  ) {
    try {
      // チャンネルメンバーを取得
      const members = await db.channelJoin.findMany({
        where: {
          channelId,
          userId: { not: excludeUserId || undefined },
        },
        select: { userId: true },
      });

      console.log(`📣 Sending notification to ${members.length} channel members`);

      // 各メンバーに送信（並列処理）
      const promises = members.map(member =>
        this.sendToUser(member.userId, payload)
      );

      const results = await Promise.allSettled(promises);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`✅ Sent to ${successCount}/${members.length} members`);

      return results;
    } catch (error) {
      console.error('❌ Error in sendToChannelMembers:', error);
      throw error;
    }
  }

  /**
   * メンションされたユーザーに送信
   */
  async sendMentionNotification(
    mentionedUserId: string,
    fromUserId: string,
    channelId: string,
    messageContent: string
  ) {
    try {
      const [fromUser, channel] = await Promise.all([
        db.user.findUnique({ where: { id: fromUserId } }),
        db.channel.findUnique({ where: { id: channelId } }),
      ]);

      await this.sendToUser(mentionedUserId, {
        title: `${fromUser?.name || 'Someone'} mentioned you in #${channel?.name}`,
        body: messageContent.substring(0, 100),
        data: {
          type: 'mention',
          channelId,
          fromUserId,
        },
        sound: 'default',
      });

      console.log(`💬 Mention notification sent to ${mentionedUserId}`);
    } catch (error) {
      console.error('❌ Error in sendMentionNotification:', error);
    }
  }

  /**
   * リアクション通知
   */
  async sendReactionNotification(
    targetUserId: string,
    fromUserId: string,
    messageId: string,
    emojiCode: string
  ) {
    try {
      const fromUser = await db.user.findUnique({ where: { id: fromUserId } });

      await this.sendToUser(targetUserId, {
        title: `${fromUser?.name || 'Someone'} reacted to your message`,
        body: `${emojiCode}`,
        data: {
          type: 'reaction',
          messageId,
          fromUserId,
          emojiCode,
        },
        sound: 'default',
      });

      console.log(`👍 Reaction notification sent to ${targetUserId}`);
    } catch (error) {
      console.error('❌ Error in sendReactionNotification:', error);
    }
  }
}

export const notificationService = new NotificationService();
