# synsk.me

小橋俊介のポートフォリオであり、共創の入り口。外部プラットフォームでの発信を集約し、時系列で見せる。

- ビジョン: [docs/VISION.md](./docs/VISION.md)
- 満たすべきこと: [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- 決定の記録: [docs/decisions/](./docs/decisions/)
- どこに何を書くか: [docs/README.md](./docs/README.md)

## 技術スタック

Next.js 16（App Router）/ TypeScript / Tailwind CSS / Cloudflare Workers

Workers 上では [`vinext`](https://vinext.dev/) を介して動く。vinext は Next.js の API を Vite プラグインとして再実装したもので、Next.js のビルド出力は使わない。Worker の設定は `wrangler.jsonc`、ビルドの設定は `vite.config.ts` が持つ。採用の理由は [ADR-0018](./docs/decisions/0018-vinext-runtime.md) にある。

## 開発

```bash
npm run dev        # 開発サーバー（http://localhost:3000）
npm run build      # プロダクションビルド（出力は dist/）
npm run lint       # リンター
npm run start      # ビルド出力をローカルで起動
npm run preview    # ビルドして Workers ランタイムでローカル起動
npm run deploy     # Cloudflare Workers へデプロイ
npm run upload     # デプロイせずバージョンだけ上げ、プレビュー URL を得る
npm run cf-typegen # binding の型を cloudflare-env.d.ts に生成
```

## 配信

本番は Cloudflare Workers Builds が `main` への push を受けてビルドし、デプロイする。ビルド構成はリポジトリではなく Cloudflare のダッシュボード（Workers & Pages → `synsk-me` → Settings → Build）が持つ。

| 欄 | 値 |
|------|------|
| ビルド コマンド | `npx vinext build` |
| デプロイ コマンド | `npx vinext-cloudflare deploy --skip-build --config dist/server/wrangler.json` |
| バージョン コマンド | `npx wrangler versions upload --config dist/server/wrangler.json` |
| プロダクション ブランチ | `main` |

**デプロイとバージョンのコマンドは `dist/server/wrangler.json` を指す。** `vinext build` はリポジトリ直下の `wrangler.jsonc` を読み、binding とアセットの位置を解決した設定を `dist/server/wrangler.json` に書き出す。直下の `wrangler.jsonc` を渡すと `dist/client` が未解決のまま扱われる。`--skip-build` はビルド コマンドとの二重ビルドを避ける。この欄はリポジトリから読めないため、デプロイの挙動が説明と合わないときは実装より先にここを見る。

`main` 以外のブランチはバージョン コマンドでビルドされ、PR にプレビュー URL がコメントされる。

## コンソール

サイトの運用に使う外部の管理画面。開いた先で対象を選ぶ。アカウント ID とプロパティ ID は書かない。配信される HTML と JS に出ていないため、書けば新たに公開することになる。

| 対象 | 選ぶもの | 用途 |
|------|---------|------|
| [Cloudflare](https://dash.cloudflare.com/) | Workers & Pages → `synsk-me` | 配信、ビルド設定、デプロイの履歴 |
| [Google アナリティクス](https://analytics.google.com/) | プロパティ `synsk.me` | アクセスの確認 |
| [Google タグ マネージャー](https://tagmanager.google.com/) | コンテナ `GTM-5C664DPR` | タグとトリガーの設定 |

## 環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Tag Manager。`WORKERS_CI_BRANCH` が `main` のビルドでのみ埋め込む |
| `WORKERS_CI_BRANCH` | Workers Builds がビルド時に渡すブランチ名。`next.config.js` が `NEXT_PUBLIC_DEPLOY_ENV` に写す |
| `PAGESPEED_API_KEY` | PageSpeed Insights API と CrUX API。`.env` は git が追跡するため `.env.local` に置く |
