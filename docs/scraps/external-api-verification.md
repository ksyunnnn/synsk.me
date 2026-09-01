# 外部プラットフォームの取得手段（2026-09-02 実測）

> 書き捨て。消えても困らないものだけを置く。

12 プラットフォームについて、公式ドキュメントと実リクエストの両方で取得可否を確定させた記録。実装は `src/lib/timeline/sources/` にある（TECHPLAY は取得手段が無いため実装を持たない）。

## 取得できる

| Platform | 経路 | 認証 | 件数の上限 |
|---|---|---|---|
| Zenn | RSS `https://zenn.dev/ksyunnnn/feed` | 不要 | 20 件固定 |
| Qiita | 公式 API v2 `https://qiita.com/api/v2/users/ksyunnnn/items` | 不要 | `per_page` 1〜100 |
| dev.to | Forem API v1 `https://dev.to/api/articles?username=ksyunnnn` | 不要 | `per_page` 1〜1000 |
| Medium | RSS `https://medium.com/feed/@ksyunnnn` | 不要 | 10 件固定 |
| GitHub | REST API `https://api.github.com/users/ksyunnnn/repos` | 不要 | `per_page` + `link` ヘッダ |
| Speaker Deck | RSS `https://speakerdeck.com/ksyunnnn.rss` | 不要 | 実測 4 件 |
| CodeSandbox | `https://codesandbox.io/embed/<id>` の OG メタ | 不要 | 個別指定 |
| Spotify | oEmbed `https://open.spotify.com/oembed?url=` | 不要 | 個別指定 |

## 認証情報があれば取得できる

| Platform | 経路 | 認証 | 根拠 |
|---|---|---|---|
| connpass | v2 API `https://connpass.com/api/v2/users/ksyunnnn/attended_events/` | `X-API-Key` ヘッダ。個人・コミュニティは無料だが申請と審査を要する | https://connpass.com/about/api/v2/ |

v1 は廃止済みで 403 を返す。

## 取得できない

| Platform | 理由 | 根拠 |
|---|---|---|
| CodePen | 公開 API が存在せず、oEmbed も Cloudflare の bot challenge で 403 | https://blog.codepen.io/docs/api/ |
| X | 無料での一覧取得ができない。認証不要なのは個別投稿指定の oEmbed のみ | https://docs.x.com/x-api/getting-started/pricing |
| TECHPLAY | 公開 API もユーザー単位のフィードも存在しない。提供されるのは全体の新着イベント RSS `https://rss.techplay.jp/event/w3c-rss-format/rss.xml` のみで、`?keyword=` を付けても内容が変わらないことを実測した。ユーザーページは 404 | 実測（2026-09-02） |

## 実装に効く制約

- **Zenn に公開 API は無い。** Zenn 運営メンバーが [zenn-dev/zenn-community#496](https://github.com/zenn-dev/zenn-community/issues/496) で明言している。`https://zenn.dev/api/articles` は 200 を返すが非公式のため採らない。
- **Medium API は提供終了。** [Medium/medium-api-docs](https://github.com/Medium/medium-api-docs) の README に明記され、リポジトリは 2023-03-02 にアーカイブ済み。
- **dev.to は User-Agent を要求する。** 空の User-Agent では 403。Cloudflare Workers の `fetch` は既定の User-Agent を付けない。
- **Cloudflare Workers の runtime に `DOMParser` は無い**（[Web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)）。RSS の解析には純 JS のパーサが要る。
- **connpass v2 のヘッダ名は `X-API-Key`。** OpenAPI の `components.securitySchemes` に定義されている。制限は API キーごとに 1 req/sec。
- **CodeSandbox の `/embed/<id>` は存在しない ID でも 200 を返す。** サイト既定の OG メタが返るため、`og:title` が既定値かどうかで判定する。
- **Spotify の oEmbed と CodeSandbox の OG メタは日付を返さない。** 時系列に並べる値を別に持つ必要がある。

## レート制限

| Platform | 未認証 | 認証時 | 出典 |
|---|---|---|---|
| GitHub | 60 req/h/IP | 5,000 req/h | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| Qiita | 60 req/h/IP | 1,000 req/h | https://qiita.com/api/v2/docs |
| connpass v2 | — | 1 req/sec | https://connpass.com/about/api/v2/ |

Cloudflare Workers は共有 IP から出るため、未認証の IP 単位の制限は他のテナントと分け合う。

## 疎通の検査

`bash scripts/check-timeline-sources.sh` が、次の 12 経路の状態を検査する。

- 「取得できる」の 8 経路が 200 を返すこと
- dev.to が User-Agent 無しでは 403 を返すこと
- CodePen の oEmbed が 403、connpass v1 が 403、connpass v2 が 401 のままであること

X と TECHPLAY は検査しない。掲載対象を手で指名する経路と、経路そのものが無いものにあたる。
