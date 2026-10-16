---
status: proposed
date: 2026-10-16
decision-makers: synsk
consulted: Claude Code
---

# プレビュー配信の応答を、Worker の入口と `_headers` で、どのキャッシュにも残さない

## Context and Problem Statement

`docs/REQUIREMENTS.md` の NFR-09 は、認証を要する応答をどのキャッシュにも残さないことを求める。認証には、配信の環境全体にかける認証を含む。プレビュー配信（`<branch>-synsk-me` と `<version>-synsk-me` の `*.workers.dev`）は全体が Access の後ろにあるため、プレビュー配信のどの応答も認証を要する。

2026-10-16 に PR #160 のプレビュー配信で確かめた事実は次のとおり。

- ブラウザと同じヘッダで取った `/` は、`Cache-Control: public, max-age=0, must-revalidate` を返した。`curl` の既定のヘッダで取ると `no-store, must-revalidate` を返した。vinext は、デプロイ時に確かめた識別子の要求にだけ、キャッシュしてよい返し方をする（[ADR-0018](./0018-vinext-runtime.md)）
- プレビュー配信では、Worker の応答に `cf-cache-status` が付かず、エッジのキャッシュに載っていなかった。プレビューでは Workers Cache が有効にならない（[cloudflare/workers-sdk#16218](https://github.com/cloudflare/workers-sdk/issues/16218)）
- `/_next/static/` のクライアント JS と `/archive-banner.js` は `cf-cache-status: HIT` を返した。`public/_headers` で `Cache-Control: no-store, must-revalidate` を付けた後も `HIT` を返した
- 鍵なしで取ると、静的ファイルも Access のログインへの 302 になった

`wrangler.jsonc` の `previews` の節は `assets` を受け付けない（wrangler 4.149.0 の `config-schema.json` の `PreviewsConfig`）。静的ファイルの配信の設定を、プレビュー配信だけで変えられない。

[ADR-0026](./0026-code-structure-adop.md) は、ルートの `worker/index.ts` を「定期実行の入口を持つ場合だけ置く」とする。

## Decision Drivers

* プレビュー配信は確かめるための場所であり、何もキャッシュに残さない（オーナー、2026-10-16）
* 本番のエッジのキャッシュを変えない
* キャッシュの動きは本番で確かめる（オーナー、2026-10-16）

## Considered Options

* プレビュー配信の応答を、ホスト名で見分けて `no-store` にする
* キャッシュさせないかを、応答の中身で決める（誰が要求しても同じで、公開していない内容を含まない応答は除く）
* 静的ファイルも Worker を通す（`assets.run_worker_first`）

## Decision Outcome

**プレビュー配信の応答を、ホスト名で見分けて `no-store` にする。** Worker の入口 `worker/index.ts` を置き、vinext の fetch ハンドラを呼んだ後、`*.workers.dev` の要求への応答の `Cache-Control` を `no-store, must-revalidate` にし、`CDN-Cache-Control` と `Cloudflare-CDN-Cache-Control` を外す。静的ファイルは、`public/_headers` のプレビュー配信のホストに当たる規則が `no-store` にする。

ADR-0026 の `worker/index.ts` を置く条件に、応答を書き換える入口を加える。

静的ファイルを、Cloudflare の静的ファイルの配信がエッジに持つことは、NFR-09 の例外とする。

### Consequences

* Good, because プレビュー配信の Worker の応答は、ブラウザにもエッジにも残らない。プレビューで Workers Cache が有効になっても残らない
* Good, because 本番は `synsk.me` だけを入口にする（`workers_dev: false`）ため、本番の応答は変わらない
* Bad, because プレビュー配信では、エッジのキャッシュに当たるかを確かめられない。本番で確かめる
* Bad, because プレビュー配信の静的ファイルは、エッジに残る。鍵なしの要求には Access のログインへの 302 が返る

### Confirmation

- `tests/unit/preview-no-store.test.ts` が、ホスト名の見分けと、ヘッダの書き換えを検査する
- `tests/integration/private-responses.test.ts` が、`*.workers.dev` への `/` の RSC が `no-store` を返し、`127.0.0.1` への同じ要求がキャッシュしてよい返し方をすることを検査する
- `scripts/verify-deploy.mjs` が、プレビュー配信で、Worker の応答が `no-store` で 2 回目が HIT を返さないこと、静的ファイルが `no-store` を返すことを検査する。本番では `/` の 2 回目が HIT を返すことを検査する

## Pros and Cons of the Options

### プレビュー配信の応答を、ホスト名で見分けて `no-store` にする — 採用

* Good, because 応答の中身の判断に頼らない
* Bad, because Worker の入口を、vinext の fetch ハンドラから自前のものに差し替える

### キャッシュさせないかを、応答の中身で決める

OWASP ASVS 5.0 の 14.2.2 と 14.3.2、MDN の [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) は、キャッシュさせないかを機密か・人ごとに違うかで決める。

* Good, because 入口を差し替えずに済む
* Bad, because 中身の判断を誤った応答が、キャッシュに残る

### 静的ファイルも Worker を通す（`assets.run_worker_first`）

* Bad, because `previews` の節で分けられず、本番の静的ファイルもすべて Worker を通る。静的ファイルへの要求は無料だが、Worker を通すと Workers の料金になる（[Billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)）
* Bad, because Worker から静的ファイルを取り出しても同じ配信を読むため、エッジに残らなくなるかは確かめていない

## More Information

- Cloudflare: [Headers](https://developers.cloudflare.com/workers/static-assets/headers/)（`_headers` の、ホスト名に当てる規則）
- issue #158、PR #160
