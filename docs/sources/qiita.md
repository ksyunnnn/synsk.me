# Qiita

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | REST |
| エンドポイント | `https://qiita.com/api/v2/users/ksyunnnn/items` |
| 認証 | 任意（`QIITA_ACCESS_TOKEN`） |
| 公式性 | 公式 |
| レート制限 | 未認証 60 req/h/IP、認証 1,000 req/h |
| 出典 | https://qiita.com/api/v2/docs |
| 実測日 | 2026-09-02（77 件） |

`per_page` は 1〜100、`page` は 1〜100。総数はレスポンスヘッダ `total-count` で取れる。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | string | 常時 | `d5af0c1e2e3b8722c868` | |
| `title` | string | 常時 | VSCode ESLintとPrettierを保存時に自動整形する設定メモ | |
| `url` | string | 常時 | `https://qiita.com/ksyunnnn/items/d5af0c1e2e3b8722c868` | |
| `created_at` | string | 常時 | `2022-05-19T10:20:46+09:00` | 公開日はこれを使う。専用フィールドは無い |
| `likes_count` | number | 常時 | `2` | |
| `stocks_count` | number | 常時 | `2` | |
| `tags[].name` | string | 常時 | `ESLint` `VSCode` `prettier` | |
| `body` | string | 常時 | Markdown 全文 | レスポンスが 214KB になる主因 |
| `rendered_body` | string | 常時 | HTML 全文 | 同上 |
| `page_views_count` | number \| null | 認証時のみ | `null` | 未認証では 77 件すべて null |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| サムネイル | API にフィールドが存在しない | 実測 2026-09-02 |
