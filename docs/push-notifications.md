# プッシュ通知機能ドキュメント

## 目次
- [概要](#概要)
- [アーキテクチャ](#アーキテクチャ)
- [セットアップ手順](#セットアップ手順)
- [API仕様](#api仕様)
- [データベーススキーマ](#データベーススキーマ)
- [iOSクライアント実装](#iosクライアント実装)
- [通知の種類](#通知の種類)
- [トラブルシューティング](#トラブルシューティング)

---

## 概要

GiracleKitのプッシュ通知機能は、Apple Push Notification service (APNs) を使用してiOSデバイスにリアルタイム通知を送信します。

### 主な機能

- **メンション通知**: ユーザーがメンションされた時に通知
- **リアクション通知**: メッセージにリアクションがついた時に通知
- **チャンネルメッセージ通知**: チャンネルに新しいメッセージが投稿された時に通知
- **通知設定管理**: ユーザーごとに通知の種類を細かく制御
- **デバイストークン管理**: 複数デバイスの登録・管理・自動削除

---

## アーキテクチャ

```
┌─────────────────┐
│   iOS Device    │
│   (GiracleKit)  │
└────────┬────────┘
         │ デバイストークン登録
         ▼
┌─────────────────┐     APNs認証キーで認証      ┌──────────────┐
│  Backend Server │ ─────────────────────────> │ APNs Server  │
│ (giracle-backend)│                             │  (Apple)     │
└─────────────────┘                             └──────┬───────┘
         │                                              │
         │ メンション/リアクション発生時                │ 通知配信
         ▼                                              ▼
┌─────────────────┐                             ┌──────────────┐
│    Database     │                             │ iOS Devices  │
│  (DeviceToken,  │                             │              │
│ NotificationSetting)│                         │              │
└─────────────────┘                             └──────────────┘
```

### コンポーネント構成

**バックエンド (`giracle-backend`)**
- `notification.service.ts`: APNs連携・通知送信ロジック
- `notification.module.ts`: APIエンドポイント定義
- `message.module.ts`: メッセージ送信時の通知トリガー
- Prismaスキーマ: `DeviceToken`, `NotificationSetting` テーブル

**iOSクライアント (`GiracleKit`)**
- `PushNotificationService.swift`: デバイストークン管理・通知受信処理
- `NotificationSettingsView.swift`: 通知設定画面UI
- `NotificationSettingsViewModel.swift`: 通知設定のビジネスロジック
- `GiracleKitApp.swift`: APNsデバイストークンのハンドリング

---

## セットアップ手順

### 1. Apple Developer Portal での設定

#### APNs認証キーの作成

1. [Apple Developer Portal](https://developer.apple.com/account) にログイン
2. **Certificates, Identifiers & Profiles** → **Keys** に移動
3. **+** ボタンをクリック
4. **Apple Push Notifications service (APNs)** にチェック
5. キーを登録し、`.p8` ファイルをダウンロード
6. **Key ID** と **Team ID** をメモ

> **注意**: `.p8` ファイルは一度しかダウンロードできません。安全な場所に保管してください。

### 2. バックエンドの環境変数設定

`giracle-dev/giracle-backend/.env` に以下の環境変数を追加：

```bash
# APNs設定
APNS_KEY_ID=XXXXXXXXXX           # Apple Developer PortalのKey ID
APNS_TEAM_ID=YYYYYYYYYY          # Apple Developer PortalのTeam ID
APNS_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8  # .p8ファイルの絶対パス
APNS_TOPIC=com.giracle.GiracleKit  # iOSアプリのBundle ID
APNS_PRODUCTION=false            # 本番環境の場合は true
```

### 3. データベースのマイグレーション

```bash
cd giracle-dev/giracle-backend
bun prisma db push
```

### 4. バックエンドの起動

```bash
bun run dev
```

起動時に以下のログが表示されれば成功：

```
✅ APNs Provider initialized
   Production mode: false
   Key ID: XXXXXXXXXX
   Team ID: YYYYYYYYYY
   Topic: com.giracle.GiracleKit
```

### 5. Xcodeプロジェクトの設定

#### Push Notifications capabilityを有効化

1. Xcodeでプロジェクトを開く
2. プロジェクトナビゲータで **GiracleKit** を選択
3. **Signing & Capabilities** タブを開く
4. **+ Capability** をクリック
5. **Push Notifications** を追加

#### Background Modes を有効化

1. 同じ画面で **+ Capability** をクリック
2. **Background Modes** を追加
3. **Remote notifications** にチェック

### 6. 実機でのテスト

> **重要**: プッシュ通知はシミュレータでは動作しません。実機が必須です。

1. 実機をMacに接続
2. Xcodeでアプリをビルド・実行
3. アプリ起動時に通知許可ダイアログが表示される
4. 「許可」を選択
5. デバイストークンがバックエンドに自動登録される

---

## API仕様

### デバイストークン登録

**エンドポイント**: `POST /notification/device-token/register`

**リクエスト**:
```json
{
  "token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "platform": "ios",
  "deviceName": "iPhone 15 Pro"
}
```

**レスポンス**:
```json
{
  "message": "Device token registered",
  "data": {
    "id": "uuid",
    "userId": "user-id",
    "token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "platform": "ios",
    "deviceName": "iPhone 15 Pro",
    "createdAt": "2025-10-26T12:00:00.000Z",
    "updatedAt": "2025-10-26T12:00:00.000Z"
  }
}
```

**認証**: Cookie (`token=xxx`) 必須

---

### デバイストークン削除

**エンドポイント**: `DELETE /notification/device-token/:token`

**パラメータ**:
- `token`: 削除するデバイストークン

**レスポンス**:
```json
{
  "message": "Device token deleted"
}
```

**認証**: Cookie (`token=xxx`) 必須

---

### 通知設定の取得

**エンドポイント**: `GET /notification/settings`

**レスポンス**:
```json
{
  "message": "Notification settings retrieved",
  "data": {
    "enableMention": true,
    "enableReaction": true,
    "enableMessage": true,
    "enableSystem": true
  }
}
```

**認証**: Cookie (`token=xxx`) 必須

---

### 通知設定の更新

**エンドポイント**: `PATCH /notification/settings`

**リクエスト**:
```json
{
  "enableMention": false,
  "enableReaction": true,
  "enableMessage": true,
  "enableSystem": false
}
```

**レスポンス**:
```json
{
  "message": "Notification settings updated",
  "data": {
    "enableMention": false,
    "enableReaction": true,
    "enableMessage": true,
    "enableSystem": false
  }
}
```

**認証**: Cookie (`token=xxx`) 必須

---

## データベーススキーマ

### DeviceToken テーブル

ユーザーのデバイストークンを管理します。

```prisma
model DeviceToken {
  id         String   @id @default(uuid())
  userId     String
  token      String   @unique
  platform   String   // "ios" または "android"
  deviceName String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
```

**フィールド説明**:
- `id`: 主キー (UUID)
- `userId`: ユーザーID (外部キー)
- `token`: APNsデバイストークン (ユニーク)
- `platform`: プラットフォーム ("ios" または "android")
- `deviceName`: デバイス名 (例: "iPhone 15 Pro")
- `createdAt`: 登録日時
- `updatedAt`: 更新日時

**特徴**:
- `userId` と `token` にインデックスを設定し、検索を高速化
- ユーザー削除時にカスケード削除 (`onDelete: Cascade`)
- 無効なトークンは自動削除される (送信失敗時)

---

### NotificationSetting テーブル

ユーザーごとの通知設定を管理します。

```prisma
model NotificationSetting {
  id             String  @id @default(uuid())
  userId         String  @unique
  enableMention  Boolean @default(true)
  enableReaction Boolean @default(true)
  enableMessage  Boolean @default(true)
  enableSystem   Boolean @default(true)
  user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**フィールド説明**:
- `id`: 主キー (UUID)
- `userId`: ユーザーID (外部キー、ユニーク)
- `enableMention`: メンション通知の有効/無効
- `enableReaction`: リアクション通知の有効/無効
- `enableMessage`: メッセージ通知の有効/無効
- `enableSystem`: システム通知の有効/無効

**デフォルト値**:
- すべての通知タイプがデフォルトで有効 (`true`)
- ユーザーが初めてデバイストークンを登録すると自動作成

---

## iOSクライアント実装

### PushNotificationService

プッシュ通知の管理を一元化するシングルトンサービス。

**主な機能**:
- 通知許可のリクエスト
- デバイストークンの取得とバックエンド登録
- フォアグラウンド通知の表示
- 通知タップ時の画面遷移

**使用例**:

```swift
// 通知許可をリクエスト
Task {
    try? await PushNotificationService.shared.requestAuthorization()
}

// 現在の許可状態を確認
Task {
    await PushNotificationService.shared.checkAuthorizationStatus()
}

// デバイストークンを手動で削除
Task {
    await PushNotificationService.shared.unregisterDeviceToken()
}
```

---

### AppDelegate統合

APNsデバイストークンを受け取るために `AppDelegate` を実装。

```swift
#if canImport(UIKit)
@UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
#endif

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushNotificationService.shared.didReceiveDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("❌ Failed to register for remote notifications: \(error)")
    }
}
```

---

### 通知設定画面

ユーザーが通知の種類を個別に制御できるUI。

**主な機能**:
- プッシュ通知の有効化ボタン
- 通知タイプごとのトグルスイッチ
- デバイストークンの表示（デバッグ用）
- リアルタイム設定保存

**ファイル**:
- `NotificationSettingsView.swift`: UI定義
- `NotificationSettingsViewModel.swift`: ビジネスロジック

---

## 通知の種類

### 1. メンション通知

**トリガー**: ユーザーがメッセージ内でメンションされた時

**実装箇所**: `message.module.ts` の `/send` エンドポイント

```typescript
// メンションを検出
const mentionRegex = /@(\w+)/g;
const mentions = message.match(mentionRegex);

if (mentions) {
  for (const mention of mentions) {
    const username = mention.slice(1);
    const mentionedUser = await db.user.findUnique({ where: { name: username } });

    if (mentionedUser && mentionedUser.id !== userId) {
      // 通知送信
      notificationService.sendMentionNotification(
        mentionedUser.id,
        userId,
        channelId,
        message
      );
    }
  }
}
```

**通知内容**:
- **タイトル**: `@username mentioned you in #channel-name`
- **本文**: メッセージの最初の100文字
- **データ**: `{ type: "mention", channelId, fromUserId }`

---

### 2. リアクション通知

**トリガー**: メッセージにリアクションが追加された時

**実装箇所**: `message.module.ts` の `/emoji-reaction` エンドポイント

```typescript
// メッセージの送信者を取得
const message = await db.message.findUnique({ where: { id: messageId } });

if (message && message.userId !== userId) {
  // 自分以外のメッセージにリアクションした場合のみ通知
  notificationService.sendReactionNotification(
    message.userId,  // 通知先
    userId,          // リアクションしたユーザー
    messageId,
    emojiCode
  );
}
```

**通知内容**:
- **タイトル**: `@username reacted to your message`
- **本文**: 絵文字コード
- **データ**: `{ type: "reaction", messageId, fromUserId, emojiCode }`

---

### 3. チャンネルメッセージ通知（将来実装予定）

**トリガー**: チャンネルに新しいメッセージが投稿された時

**実装**: `notificationService.sendToChannelMembers()` が既に実装済み

```typescript
await notificationService.sendToChannelMembers(
  channelId,
  excludeUserId,  // 送信者自身を除外
  {
    title: `New message in #${channelName}`,
    body: messageContent,
    data: { type: "message", channelId, fromUserId }
  }
);
```

---

## トラブルシューティング

### バックエンド起動時のエラー

#### 1. `error: token.keyId is missing`

**原因**: APNs環境変数が設定されていない

**解決策**:
1. `.env` ファイルに以下を追加:
   ```bash
   APNS_KEY_ID=your-key-id
   APNS_TEAM_ID=your-team-id
   APNS_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
   APNS_TOPIC=com.giracle.GiracleKit
   APNS_PRODUCTION=false
   ```
2. バックエンドを再起動

#### 2. `⚠️ APNs is NOT configured`

**原因**: APNs環境変数が一部または全て未設定

**影響**: 警告のみで、バックエンドは正常に起動します。通知送信機能のみ無効化されます。

**解決策**: 上記の環境変数を設定

---

### iOS側のエラー

#### 3. `❌ Failed to register for remote notifications`

**原因1**: シミュレータで実行している
- **解決策**: 実機でテストする

**原因2**: Push Notifications capabilityが未設定
- **解決策**: Xcodeで Push Notifications を有効化

**原因3**: プロビジョニングプロファイルの問題
- **解決策**: Apple Developer Portalで正しいプロビジョニングプロファイルを確認

#### 4. デバイストークンが取得できない

**確認事項**:
1. 実機で実行しているか
2. 通知許可を与えたか
3. アプリのBundle IDが `APNS_TOPIC` と一致しているか
4. Signing & Capabilitiesが正しく設定されているか

---

### 通知が届かない

#### 5. 通知が送信されない

**確認事項**:

1. **バックエンドログを確認**:
   ```
   📤 Sending notification to 1 device(s) for user xxx
   ✅ Notification sent to iPhone 15 Pro
   ```

2. **デバイストークンが登録されているか確認**:
   ```bash
   sqlite3 prisma/dev.db "SELECT * FROM DeviceToken WHERE userId='xxx';"
   ```

3. **通知設定が有効か確認**:
   ```bash
   sqlite3 prisma/dev.db "SELECT * FROM NotificationSetting WHERE userId='xxx';"
   ```

4. **APNs認証情報が正しいか確認**:
   - Key IDが正しいか
   - Team IDが正しいか
   - .p8ファイルのパスが正しいか
   - Bundle IDが正しいか

#### 6. `BadDeviceToken` エラー

**原因**: デバイストークンが無効または期限切れ

**自動対処**: バックエンドが無効なトークンを自動削除します

**手動対処**:
1. iOSアプリを削除
2. アプリを再インストール
3. 通知許可を再度与える
4. 新しいデバイストークンが登録される

#### 7. 本番環境で通知が届かない

**確認事項**:
1. `APNS_PRODUCTION=true` に設定されているか
2. 本番用のプロビジョニングプロファイルを使用しているか
3. App StoreまたはTestFlightからインストールしているか（Ad-hoc配布ではAPNsが動作しない場合あり）

---

## デバッグ方法

### バックエンドのログ確認

通知送信時のログ:

```bash
📤 Sending notification to 2 device(s) for user abc123
✅ Notification sent to iPhone 15 Pro
✅ Notification sent to iPad Pro
```

エラー時のログ:

```bash
❌ Failed to send notification to iPhone 15 Pro: BadDeviceToken
🗑️ Removed invalid token for iPhone 15 Pro
```

### iOSのログ確認

Xcodeのコンソールで以下のログを確認:

```
📱 Push notification authorization: true
📱 APNs Device Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
✅ Device token registered successfully
📬 Received notification in foreground
👆 Notification tapped
   Type: mention
   Channel ID: channel-123
```

### データベースの直接確認

```bash
# デバイストークンの確認
sqlite3 prisma/dev.db "SELECT * FROM DeviceToken;"

# 通知設定の確認
sqlite3 prisma/dev.db "SELECT * FROM NotificationSetting;"
```

---

## セキュリティ考慮事項

### APNs認証キーの管理

- `.p8` ファイルは **絶対にGitにコミットしない**
- `.gitignore` に `.p8` を追加
- 本番環境では環境変数または秘密情報管理サービス（AWS Secrets Manager等）を使用

### デバイストークンの取り扱い

- デバイストークンは個人情報として扱う
- ユーザー削除時にカスケード削除される設計
- 無効なトークンは自動的に削除される

### 通知内容のプライバシー

- 通知には機密情報を含めない
- メッセージ本文は最初の100文字のみ送信
- 詳細はアプリ内で確認するフロー

---

## パフォーマンス最適化

### APNs Provider の再利用

`notification.service.ts` では、APNs Providerをサーバー起動時に1回だけ初期化し、再利用しています。

```typescript
let apnProvider: apn.Provider | null = null;

if (isAPNsConfigured) {
  apnProvider = new apn.Provider({ ... });
}
```

### 並列送信

複数ユーザーへの通知は並列処理で高速化:

```typescript
const promises = members.map(member =>
  this.sendToUser(member.userId, payload)
);

await Promise.allSettled(promises);
```

### エラーハンドリング

通知送信失敗時も他の処理をブロックしないよう `.catch()` で処理:

```typescript
notificationService.sendMentionNotification(...)
  .catch(err => console.error('Failed to send mention notification:', err));
```

---

## 今後の拡張予定

### 1. Android対応

- Firebase Cloud Messaging (FCM) の統合
- `platform` フィールドを活用し、iOSとAndroidを統一的に処理

### 2. 通知履歴

- 送信済み通知のログをデータベースに保存
- ユーザーが過去の通知を確認できる機能

### 3. 通知のグルーピング

- 同じチャンネルの通知をまとめて表示
- iOS通知のThread IDを活用

### 4. カスタム通知音

- ユーザーが通知音を選択できる機能
- `payload.sound` フィールドのカスタマイズ

### 5. 静かな通知（Silent Notification）

- バックグラウンドでデータ同期を行う
- `content-available: 1` フラグの活用

---

## 参考リンク

- [Apple Push Notification service (APNs) 公式ドキュメント](https://developer.apple.com/documentation/usernotifications)
- [node-apn ライブラリ](https://github.com/node-apn/node-apn)
- [Prisma ドキュメント](https://www.prisma.io/docs)
- [Elysia フレームワーク](https://elysiajs.com)

---

## まとめ

このドキュメントでは、GiracleKitのプッシュ通知機能の全体像を説明しました。

**実装済み機能**:
- ✅ APNs連携
- ✅ デバイストークン管理
- ✅ 通知設定管理
- ✅ メンション通知
- ✅ リアクション通知
- ✅ iOSクライアント実装

**セットアップ要件**:
1. APNs認証キーの取得
2. 環境変数の設定
3. Xcodeでのcapability設定
4. 実機でのテスト

質問やバグ報告は、GitHubのIssuesまでお願いします。
