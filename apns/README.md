# APNs 証明書設定ガイド

このディレクトリは **Apple Push Notification service (APNs)** の認証キーファイルを保管する場所です。

---

## 📁 配置するファイル

Apple Developer Portal からダウンロードした **`.p8` ファイル**をこのディレクトリに配置してください。

**ファイル名の例:**
```
AuthKey_AB1C2D3E4F.p8
```

---

## 🔧 設定手順

### 1. `.p8` ファイルをこのディレクトリに配置

Apple Developer Portal からダウンロードした `.p8` ファイルを、このディレクトリ (`apns/`) にコピーしてください。

```bash
# 例: ダウンロードフォルダから移動
cp ~/Downloads/AuthKey_AB1C2D3E4F.p8 ./apns/
```

### 2. `.env` ファイルの設定を更新

プロジェクトのルートディレクトリにある `.env` ファイルを開いて、以下の値を **実際の値** に置き換えてください：

```bash
# APNs (Apple Push Notification service) 設定
APNS_KEY_ID=AB1C2D3E4F              # ← あなたの Key ID に置き換え
APNS_TEAM_ID=XXXXXXXXXX             # ← あなたの Team ID に置き換え
APNS_KEY_PATH=./apns/AuthKey_AB1C2D3E4F.p8  # ← 実際のファイル名に置き換え
APNS_BUNDLE_ID=com.giracle.GiracleKit       # ← iOSアプリの Bundle ID
APNS_PRODUCTION=false               # 開発環境は false、本番は true
```

### 3. 必要な情報の確認

#### **Key ID** の確認
- Apple Developer Portal の **Keys** ページで `.p8` ファイルをダウンロードした際に表示されます
- 例: `AB1C2D3E4F`

#### **Team ID** の確認
- Apple Developer Portal の右上に表示されています
- または **Membership** ページで確認できます
- 例: `A1B2C3D4E5`

#### **Bundle ID** の確認
- Xcode でプロジェクトを開く → **General** タブ → **Bundle Identifier**
- 例: `com.giracle.GiracleKit`

---

## 📝 設定例

```bash
# 開発環境の例
APNS_KEY_ID=8K7L9M2N3P
APNS_TEAM_ID=X9Y8Z7A6B5
APNS_KEY_PATH=./apns/AuthKey_8K7L9M2N3P.p8
APNS_BUNDLE_ID=com.giracle.GiracleKit
APNS_PRODUCTION=false
```

```bash
# 本番環境の例
APNS_KEY_ID=8K7L9M2N3P
APNS_TEAM_ID=X9Y8Z7A6B5
APNS_KEY_PATH=./apns/AuthKey_8K7L9M2N3P.p8
APNS_BUNDLE_ID=com.giracle.GiracleKit
APNS_PRODUCTION=true  # ← 本番環境では true に変更
```

---

## ⚠️ セキュリティに関する注意

### `.p8` ファイルは機密情報です！

- ✅ このファイルは **Gitにコミットしないでください**
- ✅ `.gitignore` に `apns/*.p8` が含まれていることを確認
- ✅ 安全な場所にバックアップを保管してください

### `.gitignore` の設定確認

プロジェクトのルートにある `.gitignore` ファイルに以下が含まれていることを確認：

```gitignore
# APNs 証明書
apns/*.p8
apns/*.pem
apns/*.cer
apns/*.p12
```

---

## 🚀 動作確認

設定が完了したら、サーバーを起動して確認してください：

```bash
bun dev
```

サーバー起動時に以下のようなログが出れば成功です：

```
✅ APNs initialized successfully
   - Key ID: 8K7L9M2N3P
   - Team ID: X9Y8Z7A6B5
   - Bundle ID: com.giracle.GiracleKit
   - Environment: Sandbox (Development)
```

---

## 📚 参考リンク

- [Apple Developer - Keys](https://developer.apple.com/account/resources/authkeys/list)
- [APNs Documentation](https://developer.apple.com/documentation/usernotifications)
- [node-apn GitHub](https://github.com/parse-community/node-apn)

---

## 🐛 トラブルシューティング

### エラー: `ENOENT: no such file or directory`

→ `.p8` ファイルが正しいパスに配置されていません。
   `.env` の `APNS_KEY_PATH` を確認してください。

### エラー: `Invalid APNs configuration`

→ Key ID, Team ID, Bundle ID のいずれかが間違っています。
   `.env` の設定を再確認してください。

### 通知が届かない

1. iOSアプリ側で通知パーミッションが許可されているか確認
2. デバイストークンが正しく登録されているか確認
3. `APNS_PRODUCTION` の値が環境に合っているか確認
   - Xcode実行・TestFlight: `false`
   - App Store配信: `true`

---

## ✅ チェックリスト

配置と設定が完了したら、以下を確認してください：

- [ ] `.p8` ファイルをこのディレクトリに配置した
- [ ] `.env` の `APNS_KEY_ID` を更新した
- [ ] `.env` の `APNS_TEAM_ID` を更新した
- [ ] `.env` の `APNS_KEY_PATH` を実際のファイル名に更新した
- [ ] `.env` の `APNS_BUNDLE_ID` がiOSアプリと一致している
- [ ] `.gitignore` に `apns/*.p8` が含まれている
- [ ] サーバー起動時にAPNs初期化ログが出る
