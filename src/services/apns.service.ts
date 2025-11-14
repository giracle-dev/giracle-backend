import apn from "@parse/node-apn";
import { readFile } from "node:fs/promises";

interface APNsConfig {
  keyId: string;
  teamId: string;
  keyPath: string;
  bundleId: string;
  production: boolean;
}

export class APNsService {
  private provider: apn.Provider | null = null;
  private config: APNsConfig;
  private isInitialized = false;

  constructor() {
    this.config = {
      keyId: Bun.env.APNS_KEY_ID || "",
      teamId: Bun.env.APNS_TEAM_ID || "",
      keyPath: Bun.env.APNS_KEY_PATH || "",
      bundleId: Bun.env.APNS_BUNDLE_ID || "",
      production: Bun.env.APNS_PRODUCTION === "true",
    };
  }

  /**
   * APNsプロバイダーを初期化します
   */
  async initialize(): Promise<void> {
    try {
      // 設定値の検証
      if (!this.config.keyId || !this.config.teamId || !this.config.keyPath || !this.config.bundleId) {
        console.warn("⚠️  APNs configuration is incomplete. Push notifications will be disabled.");
        console.warn("   Please check your .env file and apns/README.md for setup instructions.");
        return;
      }

      // .p8ファイルの存在確認
      try {
        await readFile(this.config.keyPath);
      } catch (error) {
        console.warn(`⚠️  APNs key file not found at: ${this.config.keyPath}`);
        console.warn("   Push notifications will be disabled.");
        console.warn("   Please place your .p8 file in the apns/ directory.");
        return;
      }

      // APNsプロバイダーの初期化
      this.provider = new apn.Provider({
        token: {
          key: this.config.keyPath,
          keyId: this.config.keyId,
          teamId: this.config.teamId,
        },
        production: this.config.production,
      });

      this.isInitialized = true;

      // 初期化成功ログ
      console.log("✅ APNs initialized successfully");
      console.log(`   - Key ID: ${this.config.keyId}`);
      console.log(`   - Team ID: ${this.config.teamId}`);
      console.log(`   - Bundle ID: ${this.config.bundleId}`);
      console.log(`   - Environment: ${this.config.production ? "Production" : "Sandbox (Development)"}`);
    } catch (error) {
      console.error("❌ Failed to initialize APNs:", error);
      console.error("   Push notifications will be disabled.");
    }
  }

  /**
   * プッシュ通知を送信します
   */
  async sendNotification(
    deviceTokens: string[],
    payload: {
      title: string;
      body: string;
      badge?: number;
      sound?: string;
      data?: Record<string, any>;
    }
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    // APNsが初期化されていない場合はスキップ
    if (!this.isInitialized || !this.provider) {
      console.warn("⚠️  APNs is not initialized. Skipping push notification.");
      return { success: 0, failed: deviceTokens.length, errors: ["APNs not initialized"] };
    }

    // 通知の作成
    const notification = new apn.Notification({
      alert: {
        title: payload.title,
        body: payload.body,
      },
      badge: payload.badge,
      sound: payload.sound || "default",
      topic: this.config.bundleId, // Bundle IDを指定
      payload: payload.data || {},
      contentAvailable: true,
      mutableContent: true,
    });

    try {
      // 通知の送信
      const result = await this.provider.send(notification, deviceTokens);

      // 結果の集計
      const successCount = result.sent.length;
      const failedCount = result.failed.length;
      const errors = result.failed.map((f) => ({
        device: f.device,
        status: f.status,
        response: f.response,
      }));

      if (failedCount > 0) {
        console.warn(`⚠️  Some push notifications failed: ${failedCount}/${deviceTokens.length}`);
        errors.forEach((err) => {
          console.warn(`   - Device: ${err.device}, Status: ${err.status}, Response:`, err.response);
        });
      }

      return {
        success: successCount,
        failed: failedCount,
        errors: errors,
      };
    } catch (error) {
      console.error("❌ Failed to send push notification:", error);
      return {
        success: 0,
        failed: deviceTokens.length,
        errors: [error],
      };
    }
  }

  /**
   * APNsプロバイダーをシャットダウンします
   */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      console.log("✅ APNs provider shut down successfully");
    }
  }

  /**
   * APNsが初期化されているかを確認します
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// シングルトンインスタンス
export const apnsService = new APNsService();
