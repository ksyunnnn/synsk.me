# X

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | oEmbed |
| エンドポイント | `https://publish.x.com/oembed?url=` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 40 回連続・並列 15 本 × 30 リクエストで全件 200。この規模では当たらない |
| 出典 | https://docs.x.com/x-api/getting-started/pricing |
| 件数 | 1 |
| 実測日 | 2026-09-02 |

X API v2 に**無料枠は存在しない**。従量課金のみで、所有リソースの読み取りが $0.001/件。認証なしで使えるのは個別投稿を指定する oEmbed だけ。

掲載対象は `src/data/manual-entries.ts` の `X_POSTS` が持つ。8 件はいずれも Zenn と Qiita の記事本文に埋め込まれた投稿で、oEmbed の `author_name` が本人を返し、投稿日も同じレスポンスから読める。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `html` | string | 常時 | blockquote のマークアップ | 本文・表示名・ハンドル・日付が読める |
| `author_name` | string | 常時 | こばしゅん | 本人確認に使った |
| `author_url` | string | 常時 | `https://twitter.com/ksyunnnn` | |
| `url` | string | 常時 | 正規化された投稿 URL | |
| `cache_age` | string | 常時 | 100 年相当 | |
| `height` | null | 常時 | `null` | 常に null。実高さは埋め込みが postMessage で通知する |

`html` は画像も引用も含まない。`https://platform.twitter.com/embed/Tweet.html?id=<id>` は含む。画像付きは画像を、引用は引用元を入れ子で持ち、**外部リンクはカードにならずリンクのテキストのまま**になる。

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| 投稿の一覧 | 無料枠が無い | https://docs.x.com/x-api/getting-started/pricing |
| いいね数・RT 数 | oEmbed に含まれない | 実測 2026-09-02 |
| `t.co` の展開後 URL | oEmbed が展開しない | 実測 2026-09-02 |
