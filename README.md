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
npm run deploy     # Cloudflare Workers へデプロイし、配信を検査する
npm run upload     # デプロイせずバージョンだけ上げ、プレビュー URL を得る
npm run verify:deploy # 配信されているものを検査する（URL を渡すとその対象を見る）
npm run cf-typegen # binding の型を cloudflare-env.d.ts に生成
```

## 配信

本番は Cloudflare Workers Builds が `main` への push を受けてビルドし、デプロイする。ビルド構成はリポジトリではなく Cloudflare のダッシュボード（Workers & Pages → `synsk-me` → Settings → Build）が持つ。

| 欄 | 値 |
|------|------|
| ビルド コマンド | `npm run build` |
| デプロイ コマンド | `npm run deploy` |
| バージョン コマンド | `npm run upload` |
| プロダクション ブランチ | `main` |

**3 欄は `npm run` を通す。** コマンドの実体を `package.json` に置き、リポジトリ側だけを読めば配信の手順が分かる状態にするため。ダッシュボードにコマンドを直接書くと、リポジトリの変更と食い違っても誰も気づけない。

**デプロイとバージョンのコマンドは `dist/server/wrangler.json` を指す。** `vinext build` はリポジトリ直下の `wrangler.jsonc` を読み、binding とアセットの位置を解決した設定を `dist/server/wrangler.json` に書き出す。直下の `wrangler.jsonc` を渡すと `dist/client` が未解決のまま扱われる。`--skip-build` はビルド コマンドとの二重ビルドを避ける。この欄はリポジトリから読めないため、デプロイの挙動が説明と合わないときは実装より先にここを見る。

**`--experimental-warm-cdn-cache` を外すと HTML がエッジのキャッシュに載らない。** vinext がページをキャッシュ可能と判定する manifest は、この二段アップロード（版を 0% で置いて経路を probe し、判定結果を載せた版を上げ直す）でしか作られない。外した版は全経路が `cache-control: no-store` になる。`--warm-cdn-target` には本番の URL が要る。warm に失敗した場合、新しい版は 0% のまま留まり、既存の版が 100% を保つ。その場合は `npx wrangler versions deploy` で昇格を選ぶ。

`/` と `/archives/2024` の `export const revalidate` は、この判定で ISR に分類されるために要る。落とすと dynamic として扱われ、キャッシュに載らない。

`main` 以外のブランチはバージョン コマンドでビルドされ、PR にプレビュー URL がコメントされる。

## 配信の検査

`npm run deploy` はデプロイの後に `scripts/verify-deploy.mjs` を実行する。**通らなければデプロイが失敗として扱われる。** 検査するのは、過去に実際に壊れたものである。

| 検査 | 落ちたときに疑うもの |
| --- | --- |
| 4 経路が 200 を返す | 経路の設定、ビルドの出力 |
| `/icon` と `/opengraph-image` が実体のある PNG を返す | `workerd` 上の satori と resvg |
| `/` と `/archives/2024` の 2 回目が `cf-cache-status: HIT` を返す | ページの `export const revalidate`、デプロイの `--experimental-warm-cdn-cache` |
| HTML に GTM のタグが入る | `next.config.js` の `env`、`WORKERS_CI_BRANCH` |
| HTML が 8 KB、クライアント JS が 200 KB 以内（gzip） | 依存の増加、フォントの読み込み |

プレビュー配信を見るときは URL を渡す。

```bash
npm run verify:deploy -- https://<version>-synsk-me.is-syunsukekobashi.workers.dev
```

エッジのキャッシュの検査はブラウザ相当のヘッダで行う。vinext の manifest は warm 時に確認した識別子だけを許可するため、素の `curl` では `BYPASS` が返る。

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
