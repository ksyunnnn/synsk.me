# dev.to

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | REST |
| エンドポイント | `https://dev.to/api/articles?username=ksyunnnn&per_page=10` |
| 認証 | 不要 |
| 公式性 | 公式（Forem API v1） |
| レート制限 | 読み取りの記載なし。書き込みのみ記載がある |
| 出典 | https://developers.forem.com/api/v1 |
| 件数 | 1 |
| 実測日 | 2026-09-02 |

**User-Agent が必須。** 空の User-Agent では 403 を返す。Cloudflare Workers の `fetch` は既定の User-Agent を付けないため、明示する。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | number | 常時 | `1715490` | |
| `title` | string | 常時 | How to use Supabase CLI & Local Dev | |
| `description` | string | 常時 | this is a memo for personal reference | |
| `url` | string | 常時 | `https://dev.to/ksyunnnn/how-to-use-supabase-cli-local-dev-5bic` | |
| `published_at` | string | 常時 | `2024-01-03T05:48:34Z` | ISO 8601 UTC |
| `public_reactions_count` | number | 常時 | `7` | `positive_reactions_count` も同値で返る |
| `social_image` | string | 常時 | `https://media2.dev.to/dynamic/image/...` | 1000x500 |
| `cover_image` | string \| null | 常時 | `null` | |
| `tag_list` | string[] | 常時 | `["supabase","docker"]` | |
| `reading_time_minutes` | number | 常時 | — | |
| `canonical_url` | string | 常時 | 自分自身を指す | クロスポストではない |
| `crossposted_at` | null | 常時 | `null` | 同上 |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| 本文 | 一覧エンドポイントには含まれない | 実測 2026-09-02 |
