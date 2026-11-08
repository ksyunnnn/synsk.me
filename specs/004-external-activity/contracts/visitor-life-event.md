# Contract: life event の個別のページ（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /life-events/{slug}`、life event がある | 200。下の DTO の値だけで描画する |
| `GET /life-events/{slug}`、life event が無い | 404。`src/proxy.ts` が描画の前に `/life-events/{slug}/missing` へ rewrite する |
| `GET /life-events/{slug}`、D1 から読めない | proxy は判定せずに通し、ページが 500 の画面を返す |

外部の activity は個別のページを持たない（FR-034）。外部の activity の `slug` は NULL で、このページの取り出しは `source = 'life_event'` の行だけを読む。

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。

## DTO

| 項目 | 元の列 |
|---|---|
| `slug` | `activity.slug` |
| `title` | `activity.title` |
| `happenedOn` | `activity.happened_on` |
| `description` | `activity.description`（空あり） |

代表画像は research.md の R11 が解けてから足す。`uid`・`id` は DTO に入れない。

## 検査

- 結合: ある識別子で 200 になり、題・起きた日・説明が出る。無い識別子と、外部の activity しか無い値で 404
- 単体: `src/proxy.ts` が無い識別子を `/life-events/{slug}/missing` へ rewrite する
