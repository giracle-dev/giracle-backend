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
