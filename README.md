# giracle-backend

## 必要パッケージのインストール
Bunが必須です。Bunが入っているならこのリポジトリのディレクトリで次のコマンドを実行。
```bash
bun i
```

## Development 開発用実行
初回の実行ならDBのプッシュを行う。
```bash
bunx prisma db push
```
開発用に実行するなら
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.
