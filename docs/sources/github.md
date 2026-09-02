# GitHub

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | REST |
| エンドポイント | `https://api.github.com/users/ksyunnnn/repos?sort=pushed&per_page=30` |
| 認証 | 任意（`GITHUB_TOKEN`） |
| 公式性 | 公式 |
| レート制限 | 未認証 60 req/h/IP、PAT 5,000 req/h |
| 出典 | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| 実測日 | 2026-09-02（公開 56 件） |

Cloudflare Workers は共有 IP から出るため、未認証の 60 req/h は他のテナントと分け合う。

OpenAPI の記述を GitHub 自身が [github/rest-api-description](https://github.com/github/rest-api-description) で公開している（MIT）。下の表はそこから引ける。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | number | 常時 | — | |
| `name` | string | 常時 | `synsk.me` | |
| `full_name` | string | 常時 | `ksyunnnn/synsk.me` | OG 画像の URL を組み立てるのに使う |
| `description` | string \| null | 常時 | `null` | |
| `html_url` | string | 常時 | `https://github.com/ksyunnnn/synsk.me` | |
| `language` | string \| null | 常時 | `Shell` | |
| `topics` | string[] | 常時 | `[]` | 追加ヘッダなしで返る |
| `stargazers_count` | number | 常時 | `0` | 最大は 3（KeepBoard） |
| `forks_count` | number | 常時 | `0` | |
| `archived` | boolean | 常時 | `false` | 除外に使う |
| `fork` | boolean | 常時 | `false` | 除外に使う |
| `pushed_at` | string \| null | 常時 | `2026-09-01T15:08:13Z` | **コミットが 1 つも無いと `null`。`new Date(null)` は 1970 になる** |
| `created_at` | string | 常時 | `2022-11-26T...` | `pushed_at` が null のときの代替 |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| サムネイル（公式経路） | REST API にフィールドが無い | 実測 2026-09-02 |
| 30 日より前の活動 | `/users/ksyunnnn/events/public` が 227 件・約 30 日で尽きる。長期は `/search/commits`（1,925 件・2016 年まで） | 実測 2026-09-02 |
| contributions カレンダー | REST に存在しない。GraphQL のみ | 実測 2026-09-02 |

`https://opengraph.githubassets.com/1/{full_name}` は OG 画像を返すが、**ドキュメントに無い経路であり、続けて叩くと 429 を返す。** 落ちたものは表示側でプラットフォームのグリフに落ちる。
