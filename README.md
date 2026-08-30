# synsk.me

小橋俊介のポートフォリオであり、共創の入り口。外部プラットフォームでの発信を集約し、時系列で見せる。

- ビジョン: [docs/VISION.md](./docs/VISION.md)
- 満たすべきこと: [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- 決定の記録: [docs/decisions/](./docs/decisions/)
- どこに何を書くか: [docs/README.md](./docs/README.md)

## 技術スタック

Next.js 15（App Router）/ TypeScript / Tailwind CSS / Cloudflare Workers

Workers 上では [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) を介して動く。Worker の設定は `wrangler.jsonc`、アダプタの設定は `open-next.config.ts` が持つ。

## 開発

```bash
npm run dev        # 開発サーバー（http://localhost:3000）
npm run build      # プロダクションビルド
npm run lint       # リンター
npm run preview    # Workers ランタイムでローカル起動
npm run deploy     # Cloudflare Workers へデプロイ
npm run cf-typegen # binding の型を cloudflare-env.d.ts に生成
```

## 環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Tag Manager。本番環境でのみ動作する |
| `NEXTJS_ENV` | Workers ランタイムが読み込む `.env` を選ぶ。git 管理外の `.dev.vars` に置く。未定義なら `production` |
