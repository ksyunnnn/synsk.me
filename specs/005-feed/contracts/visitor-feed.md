# Contract: 一覧（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /timeline` | 200。1 ページ目の 50 件を、下の DTO の値だけで描画する |
| `GET /timeline?page=N` | 200。N ページ目。N が 1 以上の整数でなければ 1 ページ目。1,000 より大きければ 1,000 ページ目（research.md の R7） |
| `GET /timeline?page=N`、N ページ目に 1 件も無い | 200。0 件の画面と「最初のページへ」のリンク |
| D1 から読めない | 500 の画面 |

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。応答は `no-store`（research.md の R12）。

## DTO

`FeedItem` は次の 5 つの型のどれか。`type` で見分ける。どの型も `id`（種類ごとの番号）と `date`（並びの日付の日本時間の暦の日付、`YYYY-MM-DD`）を持つ。

| 型 | 項目 |
|---|---|
| `note` | `slug`、`title`、`description`（空あり） |
| `external_activity` | `url`、`title`（空あり）、`source`、`sourceKind` |
| `life_event` | `slug`、`title` |
| `project` | `slug`、`title`、`organizationName`、`projectKind`、`period`、`skills`、`isMasked` |
| `career` | `organizationName`、`role`、`period`、`isMasked` |

秘匿化した実績の `title` と `organizationName` は、秘匿化した値（`title_masked`・`name_masked`）である。秘匿化した実績・職歴の DTO は、本文・関連 URL・画像を持たない。`uid` は DTO に入れない。

ページは `{ items: FeedItem[]; page: number; hasNext: boolean }` を受け取る。

## リンク

| 型 | リンク先 |
|---|---|
| `note` | `/notes/{slug}` |
| `external_activity` | `url`（取得元） |
| `life_event` | `/life-events/{slug}` |
| `project` | `/projects/{slug}` |
| `career` | なし |

## 検査

- workerd: ビューと Repository が、出す条件・秘匿化した値・並び・転載先の除外を満たす（spec の SC-001〜SC-006）
- 結合: `/timeline` の HTML に、秘匿化した実際の値・下書きの note・学歴が含まれない。`no-store` である
- E2E: 一覧の並びと、キーボードでリンクを辿れること
