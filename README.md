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

## 配信

本番は Cloudflare Workers Builds が `main` への push を受けてビルドし、デプロイする。ビルド構成はリポジトリではなく Cloudflare のダッシュボード（Workers & Pages → `synsk-me` → Settings → Build）が持つ。

| 欄 | 値 |
|------|------|
| ビルド コマンド | `npx opennextjs-cloudflare build` |
| デプロイ コマンド | `npx opennextjs-cloudflare deploy` |
| バージョン コマンド | `npx opennextjs-cloudflare upload` |
| プロダクション ブランチ | `main` |

**デプロイとバージョンのコマンドは `@opennextjs/cloudflare` の CLI を通す。** Cloudflare の既定値（`npx wrangler deploy` / `npx wrangler versions upload`）はアダプタを経由しないため増分キャッシュのアセットが生成されず、`open-next.config.ts` の `incrementalCache` が無効になる。この欄はリポジトリから読めないため、キャッシュが当たらないときは実装より先にここを見る。

`main` 以外のブランチはバージョン コマンドでビルドされ、PR にプレビュー URL がコメントされる。

## 環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Tag Manager。`WORKERS_CI_BRANCH` が `main` のビルドでのみ埋め込む |
| `WORKERS_CI_BRANCH` | Workers Builds がビルド時に渡すブランチ名。`next.config.js` が `NEXT_PUBLIC_DEPLOY_ENV` に写す |
| `PAGESPEED_API_KEY` | PageSpeed Insights API と CrUX API。`.env` は git が追跡するため `.env.local` に置く |
| `NEXTJS_ENV` | Workers ランタイムが読み込む `.env` を選ぶ。git 管理外の `.dev.vars` に置く。未定義なら `production` |
