---
status: accepted
date: 2026-10-15
decision-makers: synsk
consulted: Claude Code
---

# キャッシュを Cache Components で作り、データを読んでから決まる 404 と 403 を proxy で決める

## Context and Problem Statement

[ADR-0018](./0018-vinext-runtime.md) は、HTML をエッジのキャッシュに載せる条件の 1 つ目を、ページが `export const revalidate` を持ち ISR に分類されることとした。

2026-09-15、オーナーは次期サイトのキャッシュを Cache Components（`cacheComponents: true` と `'use cache'`）で作ると決めた。理由をオーナーは次のように述べた（2026-10-14）。

> ISRは古い技術でありエンジニアのポートフォリオとして採用したいものではないこと、また、サーバーコンポーネント自体も昨今の評判がいいものではないこと

2026-10-15 に確かめた事実は次のとおり。

- `next build`（Next.js 16.3.4）は、`cacheComponents: true` のもとで `export const revalidate` か `export const dynamic` を持つファイルがあると、`Route segment config "revalidate" is not compatible with \`nextConfig.cacheComponents\`. Please remove it.` で止まる。`vinext build`（1.0.0-beta.9）は止まらない
- Cache Components では、ストリーミングを始めた後の `notFound()` と `forbidden()` は状態コードを 200 のままにする（[Streaming](https://nextjs.org/docs/app/guides/streaming) の「The HTTP contract」）。`next build` と `next start` で、D1 の代わりに 50 ミリ秒待ってから `notFound()` を呼ぶページを作ると、`export const instant = false` を付けても 200 と `<meta name="robots" content="noindex">` を返した。`forbidden()` も 200 だった
- 公式は、描画の前に proxy で確かめる形を示す（[loading.js の Status codes](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes)）。同じ形を `next build` で作ると、404 と 403 を返した
- vinext 1.0.0-beta.9 は、ストリーミングを始めずに描画を終えるため、proxy がなくても 404 と 403 を返す
- vinext は、デプロイのときに `dist/server/vinext-prerender-paths.json` の `paths` にある URL だけをキャッシュできるか判定し、判定の結果に載らない経路を `no-store` にする。proxy の `matcher` に当たる経路は、判定で dynamic に固定する（`vinext/dist/server/app-rsc-handler.js` の `markRouteCacheabilityDynamic`）

`specs/005-note-write-and-read/spec.md` は、存在しない note・下書きの note・削除した note の `/notes/{slug}` を 404 で区別なく返すこと（FR-011）と、作り手以外に `/dash` 配下を見せないこと（FR-010）を求める。

## Decision Drivers

* 作り手だけに返す応答と、公開していない note を、キャッシュから訪問者に返さない
* `specs/005-note-write-and-read/spec.md` の FR-010 と FR-011 の状態コードを保つ
* オーナーが ISR を採らないと決めた

## Considered Options

* ISR（`export const revalidate`）に留まる
* Cache Components にし、404 と 403 はページの `notFound()` と `forbidden()` に任せる
* Cache Components にし、データを読んでから決まる 404 と 403 を proxy で決める

## Decision Outcome

**キャッシュを Cache Components で作る。キャッシュするものは `'use cache'` で選び、`export const revalidate` と `export const dynamic` は書かない。データを読んでから決まる 404 と 403 は、`src/proxy.ts` が描画の前に確かめ、`notFound()` か `forbidden()` を呼ぶだけのページへ rewrite する。** ページと Server Action の作り手の確認は残す。

`src/proxy.ts` は機能の `server/` の組み立て用の関数を呼ぶ。[ADR-0026](./0026-code-structure-adop.md) の規則 3 が挙げる `server/` の呼び手（`page.tsx`・`layout.tsx` と Server Component）に、`src/proxy.ts` を加える。

### Consequences

* Good, because 状態コードが、描画をストリーミングするかどうかに左右されない。vinext が Cache Components の約束どおりにストリーミングするようになっても、404 と 403 が保たれる
* Good, because proxy の `matcher` に当たる経路は、vinext のデプロイ時の判定で dynamic に固定され、エッジのキャッシュに載らない
* Bad, because `/notes/{slug}` と `/dash` 配下の GET のたびに、D1 への問い合わせが 1 回増える。proxy は題と本文を読まず、有無だけを確かめる
* Bad, because rewrite 先のページ（`/notes/{slug}/missing`、`/dash/notes/{id}/missing`、`/dash/forbidden`）が、直接開ける URL として残る。どれも 404 か 403 を返す
* Bad, because 本家の Next.js では、ページで呼んだ `notFound()` と `forbidden()` の画面が JavaScript なしでは出ない（[vercel/next.js#62228](https://github.com/vercel/next.js/issues/62228)、2024-02-19 から open）。この形は vinext で動かすことを前提にする。オーナーは 2026-10-15 に、本家の Next.js のビルド結果を動かす `@opennextjs/cloudflare` には戻らないと決めた

### Confirmation

- `tests/unit/cacheability.test.ts` が、`src/app` のどのファイルも `export const revalidate` と `export const dynamic` を宣言しないこと、`next.config.js` が `cacheComponents: true` を持つことを検査する
- `tests/unit/proxy.test.ts` が、proxy の `matcher` と、経路ごとの rewrite 先を検査する
- `tests/integration/cache-candidates.test.ts` が、デプロイ時に判定する URL が `/` だけであることを検査する
- `scripts/verify-deploy.mjs` が、本番で `/` の 2 回目が HIT を返すこと、存在しない note が 404 で HIT を返さないことを検査する

## Pros and Cons of the Options

### ISR（`export const revalidate`）に留まる

* Good, because ADR-0018 の時点で、本番のエッジのキャッシュに当たることを確かめている
* Bad, because オーナーが採らないと決めた

### Cache Components にし、404 と 403 はページの `notFound()` と `forbidden()` に任せる

* Good, because proxy も、D1 への余分な問い合わせも要らない。vinext 1.0.0-beta.9 では、これで 404 と 403 になる
* Bad, because Cache Components の約束では、データを読んだ後の `notFound()` と `forbidden()` は 200 になる。vinext がその約束どおりに動くようになると、FR-010 と FR-011 の状態コードが崩れる

### Cache Components にし、データを読んでから決まる 404 と 403 を proxy で決める — 採用

* Good, because Next.js の公式が示す形であり、ストリーミングの有無に状態コードが左右されない
* Bad, because proxy と rewrite 先のページを足し、D1 への問い合わせが増える

## More Information

- Next.js: [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)（2026-10-02 更新）
- Next.js: [Streaming](https://nextjs.org/docs/app/guides/streaming)（2026-10-06 更新）
- Next.js: [loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading)（2026-09-23 更新）
- Next.js: [proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)（2026-09-04 更新）
