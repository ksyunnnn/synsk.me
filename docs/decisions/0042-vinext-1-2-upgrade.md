---
status: proposed
date: 2026-10-18
decision-makers: synsk
consulted: Claude Code
---

# vinext 1.2 に上げ、RSC の要求の 403 と 404 を表示で伝え、デプロイ時のキャッシュ判定を使わない

## Context and Problem Statement

2026-10-14、vinext は GHSA-8969-277p-8rrm（Server Action のクロージャと inline `'use cache'` の捕捉値の偽造、High）と GHSA-2956-r8mj-w5c4（長いキャッシュキーの衝突、Medium）を公開した。修正は vinext 1.2.0 と `@vinext/cloudflare` 1.1.1 にある。vinext 1.2.1 は React 19.3.1 以上を求める。

vinext 1.0.0-beta.9 から 1.2.1 に上げて、2026-10-17 から 2026-10-18 に確かめた事実は次のとおり。

- vinext 1.1.0 は、RSC の要求でページを描画の前に試し実行する処理をやめた（cloudflare/vinext#3699）。ページの `forbidden()` と `notFound()` は、RSC の要求では状態コード 200 と、本文の `NEXT_HTTP_ERROR_FALLBACK;403`（`;404`）になる。HTML の要求は 403 と 404 のまま。PR は Next.js 16.2.7 の動的な経路と同じ動きとしている。下書き・削除した note の題と本文は、RSC の応答に含まれなかった
- `forbidden.tsx` がないと、リンクで移動したときの 403 で画面全体が消えた（ブラウザで React の error #441）。`src/app/forbidden.tsx` を置くと、その画面が出た。Next.js は `forbidden.js` を実験的な機能とする（[forbidden.js](https://nextjs.org/docs/app/api-reference/file-conventions/forbidden)）
- vinext 1.2.1 は、`next.config.js` の rewrites の `fallback` を、デプロイ時のキャッシュ判定から経路を外す材料に使わない。判定の対象に `/dash`・`/dash/forbidden`・`/dash/notes/new` が入る。判定は本番の URL へ要求を送り、Access は認証のない `https://synsk.me/dash` に 302 を返す。302 は判定の失敗になり、デプロイが止まる（`@vinext/cloudflare/dist/cacheability-probe.js`、`deploy.js`）。判定の要求にヘッダを足す設定はない
- 判定を行わない版を本番に 0% で置き、版を指定して `https://synsk.me/` を要求すると、2 回目から `cf-cache-status: HIT` を返し、`age` が増えた。存在しない note は `BYPASS` だった
- vinext 1.2.1 は、GET の応答を Workers Cache を通して返し、応答の `CDN-Cache-Control`（なければ `Cache-Control`）が `private` か `no-store` でなければ保存する（`@vinext/cloudflare/dist/cache/cdn-adapter.worker.js` の `forbidsSharedStorage`）。手元のビルドで、保存してよい指示を持つのは `/` だけで、作り手の画面と note の画面は `no-store` だった

## Decision Drivers

* vinext の脆弱性を、修正のある版で塞ぐ
* 下書き・削除した note を、作り手以外に見せない（`specs/005-note-write-and-read/spec.md` の FR-005、FR-011）
* デプロイが Access で止まらない

## Considered Options

* vinext 1.0.0-beta.9 に留まる
* vinext 1.2 に上げ、RSC の要求にも 403 と 404 を状態コードで返すよう作り替える（rewrite 先を Route Handler にする）
* vinext 1.2 に上げ、RSC の要求の 403 と 404 は表示で伝える

## Decision Outcome

**vinext 1.2 に上げ、RSC の要求の 403 と 404 は表示で伝える。** 状態コードは、ページを開く要求（HTML）に対して保つ。`src/app/forbidden.tsx` を置く。

**デプロイ時のキャッシュ判定（`--warm-cache`）を使わない。** `/` のエッジのキャッシュは、ページの `'use cache'` と、Workers Cache への保存で保たれる。

この記録は、[ADR-0040](./0040-cache-components.md) の Consequences の「状態コードが、描画をストリーミングするかどうかに左右されない」を RSC の要求について改め、[ADR-0018](./0018-vinext-runtime.md) のエッジのキャッシュの 3 つ目の条件（デプロイ時の判定）を外す。

### Consequences

* Good, because vinext の 2 件の脆弱性の修正を持つ版で動く
* Good, because リンクで 404 の画面へ移るとき、ページを読み直さない
* Good, because デプロイが Access の後ろの経路に左右されない
* Bad, because RSC の要求の状態コードから、403 と 404 を見分けられない。見分けるには本文を読む
* Bad, because 実験的な機能の `forbidden.tsx` に頼る。`forbidden()` は ADR-0040 で既に使っている
* Bad, because エッジのキャッシュに載るかを、デプロイの前に確かめなくなる。デプロイの後に `scripts/verify-deploy.mjs` が確かめる

### Confirmation

- `tests/integration/private-responses.test.ts` が、RSC の要求の 403 と 404 が状態コード 200 と本文の `NEXT_HTTP_ERROR_FALLBACK` で返り、`no-store` で、題と本文を含めないことを検査する
- `tests/integration/dash.test.ts` が、`package.json` の `deploy` がデプロイ時の判定を使わないことを検査する
- `tests/integration/cache-candidates.test.ts` が、`/` が保存できる応答になることを検査する
- `scripts/verify-deploy.mjs` が、本番で `/` の 2 回目が HIT を返すことを検査する

## Pros and Cons of the Options

### vinext 1.0.0-beta.9 に留まる

* Bad, because vinext の 2 件の脆弱性が残る

### RSC の要求にも 403 と 404 を状態コードで返すよう作り替える

* Good, because 契約の状態コードを、要求の種類によらず保つ
* Bad, because 403 と 404 の画面が、ルートレイアウトと `not-found.tsx` を通らず、HTML を手で書くことになる
* Bad, because ブラウザ側は RSC の状態コードを読まず（cloudflare/vinext#3699）、利用者の見る結果が変わらない

### RSC の要求の 403 と 404 は表示で伝える — 採用

* Good, because vinext と Next.js の動きに合わせ、作り替えが要らない
* Bad, because 契約の状態コードを、HTML の要求に限る

## More Information

- Next.js: [Streaming](https://nextjs.org/docs/app/guides/streaming) の「The HTTP contract」
- Cloudflare: [Version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/)（判定を行わない版を、本番で 0% にして確かめた方法）
- [Next.js Security Update for Upstream Vulnerabilities](https://nextjs.org/blog/nextjs-security-update-october-14-2026)、PR #162
