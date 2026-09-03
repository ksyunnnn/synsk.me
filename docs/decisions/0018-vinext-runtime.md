---
status: proposed
date: 2026-09-04
decision-makers: synsk
---

# Next.js を Cloudflare Workers 上で vinext を介して動かす

## Context and Problem Statement

[ADR-0012](./0012-cloudflare-hosting.md) は synsk.me を Cloudflare 上で動かすと決めたが、Next.js をどの方式で Workers に載せるかは決定として記録していない。`@opennextjs/cloudflare` は Consequences の中で言及されるだけである。

Cloudflare の [Next.js フレームワーク ガイド](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) は 2026-09-04 時点で次のように書く。

> Cloudflare recommends vinext as the default way to run Next.js applications on Cloudflare Workers.

同じページは `@opennextjs/cloudflare` を「vinext へ移れない既存アプリ向け」と位置づける。

両者は構造が違う。`@opennextjs/cloudflare` は `next build` の出力を包む。`vinext` は Next.js の API を Vite プラグインとして再実装し、Next.js のビルド出力を使わない。

2026-09-04 に `npx vinext@1.0.0-beta.9 check` を実行した結果は 88% compatible（11 supported, 1 partial, 1 issues）。未対応と報告されたのは `package.json` の `"type": "module"` の欠如だけで、これは `vinext init` が足す。partial は `next/font/google` 1 件。`next/og` は 2 ファイルで検出され `ImageResponse via @vercel/og` として supported と報告された。

## Decision Drivers

* [おもしろさ over 安全圏](../PRINCIPLES.md#3-おもしろさ)
* TTFB の閾値（[ADR-0017](./0017-display-speed-thresholds.md) が定める 800 ミリ秒。要件としては NFR-06）

## Considered Options

* `@opennextjs/cloudflare` に留まる
* `vinext`

## Decision Outcome

**Next.js を `vinext` を介して Cloudflare Workers 上で動かす。** Cloudflare が既定として推奨する方式であり、synsk.me は `@opennextjs/cloudflare` に留まる理由（vinext との互換の隙間）を持たない。

### Consequences

* Good, because Next.js のビルド出力を reverse-engineer する層がなくなる
* Good, because ビルドが 8.6 秒で終わる（2026-09-04、`npm run build` の実測）
* Good, because `next/font/google` の Lato が `/_next/static/_vinext_fonts/` 配下から自ホストで配信される（2026-09-04 実測。vinext の README が Known gap として挙げる CDN 読み込みには該当しなかった）
* Bad, because **HTML がエッジにキャッシュされない。** 2026-09-04 の実測で、`@opennextjs/cloudflare` による `https://synsk.me/` は `cache-control: s-maxage=31536000` と `x-nextjs-cache: HIT` を返す。vinext のプレビュー配信（バージョン `f0079388`）は `cf-cache-status: BYPASS`、`cache-control: no-store, must-revalidate` を返す。vinext 1.0.0-beta.9 は App Router のページを静的に分類できず（ビルド出力が `Some routes could not be classified` と報告する）、`vite.config.ts` に `prerender: { routes: "*" }` を置いても `/` と `/archives/2024` は `dynamic` として skip される。`export const revalidate` を足すと ISR に分類されるが、データキャッシュを構成していないため `X-Vinext-Cache: MISS` のままである。[#38](https://github.com/ksyunnnn/synsk.me/issues/38) が戻したキャッシュの当たりは、この決定によって失われる
* Bad, because `/` の HTML が 14,962 バイトから 20,895 バイトに増えた（2026-09-04 実測）
* Bad, because beta に依存する。`vinext` は 1.0.0-beta.9 であり、README が `not yet a drop-in replacement for every application or production workload` と明記する
* Bad, because Cloudflare のダッシュボードが持つ Workers Builds の 3 欄（ビルド・デプロイ・バージョンの各コマンド）を書き換えないと配信が成立しない。リポジトリの変更だけでは完結しない

### Confirmation

2026-09-04 に次を実測した。

| 対象 | 手段 | 結果 |
| --- | --- | --- |
| `/`、`/archives/2024`、`/icon`、`/opengraph-image` | 開発サーバ（`vinext dev`）への `curl` | 4 経路とも 200 |
| 同上 | `npm run build` の出力を `wrangler dev` で起動して `curl` | 4 経路とも 200 |
| 同上 | プレビュー配信（`wrangler versions upload`）への `curl` | 4 経路とも 200 |
| `/icon`、`/opengraph-image` の中身 | 先頭バイトの確認 | `8950 4e47 0d0a 1a0a` と `IHDR`。32x32 と 1200x630 の PNG |
| `NEXT_PUBLIC_DEPLOY_ENV` | `WORKERS_CI_BRANCH=main npm run build` の出力を検索 | `googletagmanager` を含むクライアント チャンクが 1 件。変数なしのビルドでは 0 件 |
| 静的アセットのキャッシュ | プレビュー配信の `/_next/static/media/*.svg` への `curl` | `cache-control: public,max-age=31536000,immutable`（`public/_headers` の指定どおり） |
| lint と整形 | `npm run lint`、`npm run format:check` | どちらも exit 0 |

TTFB の比較は下していない。`curl` を数回ずつ実行する方法では値が収束しなかった。`/` について 7 標本ずつ取った中央値は vinext のプレビュー配信が 108 ミリ秒、`https://synsk.me/` が 56 ミリ秒だったが、別の 5 標本ずつでは 131 ミリ秒と 385 ミリ秒で順序が入れ替わった。いずれも NFR-06 が定める「モバイルとデスクトップそれぞれの75パーセンタイル」ではない。NFR-03（LCP）と NFR-07（FCP）も測っていない。75パーセンタイルの実測は本番の訪問がないと得られないため、デプロイの後に [#62](https://github.com/ksyunnnn/synsk.me/issues/62) で測る。

エッジのキャッシュに当たらない状態を解消する作業は [#61](https://github.com/ksyunnnn/synsk.me/issues/61) が持つ。この記録は Workers KV をデータ キャッシュに割り当てない状態を出発点として提案する。

この記録が `proposed` である理由は、エッジのキャッシュを手放す代償が承認の時点で見えていなかったことによる。[#57](https://github.com/ksyunnnn/synsk.me/issues/57) と [#59](https://github.com/ksyunnnn/synsk.me/issues/59) が承認したのは vinext への移行であり、[#38](https://github.com/ksyunnnn/synsk.me/issues/38) が戻したキャッシュの当たりを手放すことは、その時点の既知のギャップに入っていない。この代償を承認したときに `accepted` にする。

## Pros and Cons of the Options

### `@opennextjs/cloudflare` に留まる

* Good, because 全ページが事前生成され、エッジのキャッシュに当たる（[#38](https://github.com/ksyunnnn/synsk.me/issues/38)）
* Good, because 2026-09-04 時点で beta ではない（1.20.6）
* Bad, because Cloudflare のドキュメントが「vinext へ移れない既存アプリ向け」と位置づける方式に留まることになる
* Bad, because `next build` の出力に載るため、Next.js の版が上がるたびに追随の遅れを受ける

### `vinext` — 採用

* Good, because Cloudflare が既定として推奨する
* Good, because ビルドが速く、フォントが自ホストされる
* Bad, because App Router のページの静的分類が未完成で、エッジのキャッシュに当たらない
* Bad, because beta である

## More Information

- [Cloudflare: Next.js フレームワーク ガイド](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [vinext](https://vinext.dev/)
- [cloudflare/vinext](https://github.com/cloudflare/vinext)
- [cloudflare/vinext#1487](https://github.com/cloudflare/vinext/issues/1487)（`revalidate` / `force-static` が安定した値を返さない）
- [ADR-0012: ホスティングに Cloudflare を採用する](./0012-cloudflare-hosting.md)
- [ADR-0017: 表示速度の指標と閾値](./0017-display-speed-thresholds.md)
- 作業の記録: [#59](https://github.com/ksyunnnn/synsk.me/issues/59)
