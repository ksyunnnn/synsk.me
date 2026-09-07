---
status: accepted
date: 2026-09-07
decision-makers: synsk
consulted: Claude
---

# synsk.me の正規ホスト名を apex にする

## Context and Problem Statement

[ADR-0016](./0016-url-conventions.md) は URL のパス設計を決めたが、ホスト名を決めていない。`www` を付けるかどうかで、外部プラットフォームへ転載した記事に設定する canonical の値が変わる（[ADR-0006](./0006-posse-publishing-strategy.md)）。転載先に設定した値はこちらから直せないため、後から変えられない。

Vercel 上では apex から `www` へ転送していた。2026-08-29 時点で、ネームサーバーは `ns1.vercel-dns.com` / `ns2.vercel-dns.com`、`https://synsk.me/` は 308 で `https://www.synsk.me/` へ転送し、`www.synsk.me` を Vercel が配信していた。

Cloudflare Workers のカスタム ドメインは apex を指定できる。条件はアクティブな Cloudflare ゾーンであることと、そのホスト名が既存の CNAME レコードを持たないことである（[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)）。

## Considered Options

* apex（`synsk.me`）
* `www.synsk.me`

## Decision Outcome

**`synsk.me` を正規ホスト名とし、`www.synsk.me` から 301 で転送する。** URL が短いほうがかっこいいため。

### Consequences

* Good, because `www.synsk.me` 宛の URL が失われない。転送はクエリ文字列を保持する
* Bad, because **転送の設定がリポジトリから読めない。** Cloudflare のゾーン `synsk.me` の Redirect Rules が持ち、`wrangler.jsonc` には `routes` の記載がない

### Confirmation

`https://synsk.me/` が 200 を返し、`https://www.synsk.me/` が 301 と `location: https://synsk.me/` を返すことで判定する。

2026-09-07 に実測した状態は次のとおり。

| 対象 | 値 |
| --- | --- |
| ネームサーバー | `veda.ns.cloudflare.com` / `cleo.ns.cloudflare.com` |
| `synsk.me` | A `104.21.93.158` / `172.67.211.186`、AAAA あり |
| `www.synsk.me` | 同じ A レコード |
| `https://synsk.me/` | 200 |
| `https://www.synsk.me/` | 301、`location: https://synsk.me/` |

2026-09-07 に Cloudflare の API から取得したゾーン `synsk.me`（`ce6cdbf7a3fe41139c91890e55d5b9b0`、status: active）の設定は次のとおり。転送は `http_request_dynamic_redirect` フェーズにある Redirect Rule 1 件が行っていた。Page Rules と Bulk Redirects は使っていない。`http_request_transform` と `http_request_late_transform` の各フェーズには entrypoint ruleset が存在しない。

| 項目 | 値 |
| --- | --- |
| 説明 | `www を synsk.me へ 301 で転送する` |
| 条件 | `http.request.full_uri wildcard r"https://www.*"` |
| 動作 | `redirect`、`status_code: 301`、`preserve_query_string: true` |
| 転送先 | `wildcard_replace(http.request.full_uri, r"https://www.*", r"https://${1}")` |
| 有効 | true |

## More Information

- [ADR-0006: 発信戦略として POSSE を採用する](./0006-posse-publishing-strategy.md)
- [ADR-0016: URL の規則](./0016-url-conventions.md)
- [Custom Domains · Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
