# Contract: life event の個別のページ（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /life-events/{slug}`、その slug の life event がある | 200。下の DTO の値だけで描画する |
| `GET /life-events/{slug}`、life event が無い（書き換える前の古い slug を含む） | 404。`src/proxy.ts` が描画の前に `/life-events/{slug}/missing` へ rewrite する |
| `GET /life-events/{slug}`、D1 から読めない | proxy は判定せずに通し、ページが 500 の画面を返す |

life event は訪問者に見せない状態を持たない（FR-026）ので、保存した life event はすべて 200 になる。外部の activity は個別のページを持たない（FR-034）。キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。

## DTO `VisitorLifeEvent`

Repository の実装は `source = 'life_event'` の行から、次の列だけを SELECT して詰める。画面・`<title>`・OGP・RSC の応答は、この形の値だけを使う。

| 項目 | 元の列 |
|---|---|
| `slug` | `activity.slug` |
| `title` | `activity.title`（空あり。題を必ず入れるかは spec の未決） |
| `description` | `activity.description`（空あり）。書式は plan.md の「spec が決めないもの」 |
| `happenedOn` | `activity.happened_on`（暦の日付） |
| `cardImageUrl` | `activity.card_media_id` の画像の `/life-events/{slug}/media/{media.storage_key}` の URL（空あり。`storage_key` は共有担当の `src/shared/domain/media.ts` の `MediaStorageKey`） |

`activity.id`・`activity.uid`・`created_at`・`updated_at` を含めない。

## 画像の経路

| 要求 | 応答 |
|---|---|
| `GET /life-events/{slug}/media/{画像}`、その life event の代表画像 | 200。R2 の原本を変換せずに返す（U5 の決定、2026-11-09） |
| 上記で、画像が無いか、ほかの持ち主の画像 | 404 |

life event は訪問者に見せない状態を持たない（FR-026）ので、画像の応答は公開の応答として扱う。R2 のバケットは公開しない（FR-030）。

## 検査

- 結合: ある slug で 200 と DTO の値、無い slug と書き換える前の slug で 404（SC-007、FR-034）
- 結合: 代表画像の経路が 200 で、ほかの life event の画像の id では 404（FR-029・FR-030）
- 単体: `src/proxy.ts` が `/life-events/{slug}` の有無で rewrite する（`tests/unit/proxy.test.ts`）
