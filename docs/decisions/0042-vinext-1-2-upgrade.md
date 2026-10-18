---
status: proposed
date: 2026-10-18
decision-makers: synsk
consulted: Claude Code
---

# vinext 1.2 に上げ、RSC の要求の 403 と 404 を表示で伝え、デプロイ時のキャッシュ判定を使わない

## Context and Problem Statement

2026-10-14、vinext は GHSA-8969-277p-8rrm（High）と GHSA-2956-r8mj-w5c4（Medium）を公開した。修正は vinext 1.2.0 と `@vinext/cloudflare` 1.1.1 にある。

vinext 1.2.1 に上げると、次のことが起きた（2026-10-18 に確かめた）。

- リンクで画面を移るときの RSC の要求では、`forbidden()` と `notFound()` が状態コード 200 になり、本文の `NEXT_HTTP_ERROR_FALLBACK;403`（`;404`）で伝わる。ページを開く要求（HTML）は 403 と 404 のまま。cloudflare/vinext#3699 は、Next.js の動的な経路と同じ動きとする。下書きと削除した note の題と本文は、RSC の応答に含まれない
- `forbidden.tsx` がないと、リンクで移ったときの 403 で画面全体が消える
- デプロイ時のキャッシュ判定は、本番の URL へ要求を送る。Access が守る `/dash` は 302 を返し、デプロイが止まる。vinext 1.2.1 には `/dash` を判定から外す設定がない
- vinext 1.2.1 は、`no-store` と `private` を持たない応答をエッジのキャッシュに保存する。デプロイ時のキャッシュ判定がなくても、本番で `/` は 2 回目から `cf-cache-status: HIT` を返した

## Decision Drivers

* vinext の脆弱性を、修正のある版で塞ぐ
* 下書きと削除した note を、作り手以外に見せない
* デプロイが Access で止まらない

## Considered Options

* vinext 1.0.0-beta.9 に留まる
* vinext 1.2 に上げ、RSC の要求にも 403 と 404 を状態コードで返すよう作り替える
* vinext 1.2 に上げ、RSC の要求の 403 と 404 は表示で伝える

## Decision Outcome

**vinext 1.2 に上げ、RSC の要求の 403 と 404 は表示で伝える。** 状態コードは、ページを開く要求（HTML）に対して保つ。`src/app/forbidden.tsx` を置く。

**デプロイ時のキャッシュ判定を使わない。** キャッシュに載せるページは `'use cache'` を付けて選ぶ。載ってよい経路は `tests/integration/cache-candidates.test.ts` の `CACHEABLE_PATHS` と `IMAGE_PATHS` が持つ。

この記録は、[ADR-0040](./0040-cache-components.md) の Consequences の「状態コードが、描画をストリーミングするかどうかに左右されない」を RSC の要求について改め、[ADR-0018](./0018-vinext-runtime.md) のエッジのキャッシュの 3 つ目の条件（デプロイ時のキャッシュ判定）を外す。

### Consequences

* Good, because vinext の 2 件の脆弱性の修正を持つ版で動く
* Good, because デプロイが Access の後ろの経路に左右されない
* Bad, because RSC の要求の状態コードから、403 と 404 を見分けられない。見分けるには本文を読む
* Bad, because 実験的な機能の `forbidden.tsx` に頼る
* Bad, because キャッシュに載るかを、デプロイの前に確かめられない。デプロイの後に `scripts/verify-deploy.mjs` が確かめる

### Confirmation

- `tests/integration/private-responses.test.ts` が、作り手の画面と note の画面が `no-store` で、RSC の 403 と 404 が本文の `NEXT_HTTP_ERROR_FALLBACK` で伝わり、題と本文を含めないことを検査する
- `tests/integration/cache-candidates.test.ts` が、保存できる応答の経路が `CACHEABLE_PATHS` と `IMAGE_PATHS` に収まることを検査する
- `tests/unit/cacheability.test.ts` が、`package.json` の `deploy` がデプロイ時のキャッシュ判定を使わないことを検査する
- `scripts/verify-deploy.mjs` が、本番で `/` の 2 回目が HIT を返すことを検査する

## Pros and Cons of the Options

### vinext 1.0.0-beta.9 に留まる

* Bad, because vinext の 2 件の脆弱性が残る

### RSC の要求にも 403 と 404 を状態コードで返すよう作り替える

* Bad, because 403 と 404 の画面が、ルートレイアウトと `not-found.tsx` を通らず、HTML を手で書くことになる
* Bad, because ブラウザは RSC の要求の状態コードを読まず、利用者の見る結果が変わらない

### RSC の要求の 403 と 404 は表示で伝える — 採用

* Good, because vinext と Next.js の動きに合わせ、作り替えが要らない
* Bad, because 契約の状態コードを、HTML の要求に限る

## More Information

- Next.js: [Streaming](https://nextjs.org/docs/app/guides/streaming) の「The HTTP contract」
- Next.js: [forbidden.js](https://nextjs.org/docs/app/api-reference/file-conventions/forbidden)
- PR #162、#181
