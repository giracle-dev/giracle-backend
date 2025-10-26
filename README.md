# giracle-backend

## 必要パッケージのインストール
Bunが必須です。Bunが入っているならこのリポジトリのディレクトリで次のコマンドを実行。
```bash
bun i
```

## Development 開発用実行
初回の実行ならDBのプッシュと初期データの挿入を行う。
```bash
bunx prisma db push #DB構造の適用
bun ./prisma/seeds.ts #初期データの挿入
```
開発用に実行するなら
```bash
bun dev
```

Open http://localhost:3000/ with your browser to see the result.

## プッシュ通知機能

GiracleKitは、Apple Push Notification service (APNs) を使用したプッシュ通知機能を提供します。

### 主な機能
- メンション通知
- リアクション通知
- ユーザーごとの通知設定管理
- 複数デバイス対応

### セットアップ
詳細なセットアップ手順とAPI仕様については、以下のドキュメントを参照してください：

📖 **[プッシュ通知機能ドキュメント](docs/push-notifications.md)**

### クイックスタート

1. Apple Developer Portalで APNs認証キー (.p8) を取得
2. `.env` に以下を追加:
   ```bash
   APNS_KEY_ID=your-key-id
   APNS_TEAM_ID=your-team-id
   APNS_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
   APNS_TOPIC=com.giracle.GiracleKit
   APNS_PRODUCTION=false
   ```
3. サーバーを起動: `bun dev`

> **注意**: APNs設定がなくてもサーバーは起動しますが、プッシュ通知機能は無効化されます。
