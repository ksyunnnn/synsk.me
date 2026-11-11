# Contract: 一覧（訪問者）

## 経路

一覧の画面の URL は plan.md の U1 が決める。下の表は `{一覧}` と書く。

| 要求 | 応答 |
|---|---|
| `GET {一覧}` | 200。1 ページ目を、下の DTO の値だけで描画する |
| `GET {一覧}?page={n}` | 200。n ページ目。最後のページの先は項目を並べず、1 ページ目へのリンクを出す（research.md の R8）。ページ送りは tasks.md の Phase 5 で足す |
| `GET {一覧}`、並ぶ activity が 0 件 | 200。0 件の表示（NFR-02） |
| `GET {一覧}`、D1 から読めない | 500 の画面 |

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。データを読んでから決まる 404 は無い（research.md の R9）。

## DTO `FeedItem`

Repository の実装はビュー `activity_feed`（data-model.md）から読み、種類ごとに次の項目だけを詰める。画面・`<title>`・OGP・RSC の応答は、この形の値だけを使う。どの種類にも `item_number`・`uid`・`updated_at` を入れない。`created_at` は note の作成日（並びの日付）としてだけ入れる（research.md の R6）。並びの日付の項目のうち、日時（`createdAt`・`publishedAt`）はビューの元の UTC の値の列から、暦の日付（`happenedOn`）は `sort_at` から詰める。ビューの `sort_at` は、日時を Asia/Tokyo の時刻にした並びの値で、時点ではない（data-model.md）。下の表の「元の列」は、ビューの列がどの表の列から来るかを示す

### 職歴（`type: 'career'`）

| 項目 | 元の列 |
|---|---|
| `type` | `'career'` |
| `isMasked` | `career.is_masked` |
| `organizationName` | 秘匿化しない行はビューの `organization_name`（元は `organization.name`）、秘匿化した行は `organization_name_masked`（元は `organization.name_masked`） |
| `role` | `career.role` |
| `period` | `career.started_on`・`career.ended_on` |

秘匿化した職歴も同じ項目を持つ。本文の中身・本文が空かどうか・関連 URL・画像を持たない（FR-012・FR-013）。秘匿化した行の本文は、画面が `isMasked` を見て伏せた見た目で出す（001 の spec の FR-021）。

### 実績（`type: 'project'`）

| 項目 | 元の列 |
|---|---|
| `type` | `'project'` |
| `isMasked` | `project.is_masked` |
| `title` | 秘匿化しない行はビューの `title`（元は `project.title`）、秘匿化した行は `title_masked`（元は `project.title_masked`） |
| `organizationName` | 秘匿化しない行はビューの `organization_name`、秘匿化した行は `organization_name_masked` |
| `projectKind` | `project.kind` |
| `period` | `project.started_on`・`project.ended_on` |
| `slug` | `project.slug`。個別のページ `/projects/{slug}` へのリンクに使う（plan.md の U4） |
| `imageUrl` | 代表画像を配る経路 `/projects/{slug}/media/{card_storage_key}`（`routes.projectMedia`）。無ければ `null`。秘匿化した実績は常に `null`（plan.md の U5） |

秘匿化した実績も `slug` を持つ。個別のページを持ち、識別子は uid で、実際の題や組織名を含まない（001 の spec の Edge Cases・FR-013）。秘匿化した実績は、本文の中身・本文が空かどうか・関連 URL・代表画像・本文の画像を持たない（FR-012・FR-013）。

### note（`type: 'note'`、tasks.md の Phase 4 で足す）

| 項目 | 元の列 |
|---|---|
| `type` | `'note'` |
| `title` | 公開した版の `note_revision.title` |
| `description` | 公開した版の `note_revision.description`（空あり） |
| `createdAt` | `created_at`（元は `note.created_at`） |
| `slug` | `note.slug`。個別のページ `/notes/{slug}` へのリンクに使う（plan.md の U4） |
| `imageUrl` | 代表画像を配る経路 `/notes/{slug}/media/{card_storage_key}`（`routes.noteMedia`。識別子は符号化する）。note に上げて選んだ画像だけで、無ければ `null`（plan.md の U5、ADR-0053） |

最も新しい版・転載先を持たない（FR-006）。

### 外部の activity（`type: 'external_activity'`、tasks.md の Phase 6 で足す）

| 項目 | 元の列 |
|---|---|
| `type` | `'external_activity'` |
| `title` | `activity.title` |
| `url` | `activity.url`。画面は取得元の URL へ直接リンクする（FR-020） |
| `publishedAt` | `published_at`（元は `activity.published_at`） |
| `source` | `activity.source` |
| `sourceKind` | `activity_source.kind`（`article`・`embed`・`other`） |
| `imageUrl` | `image_url`（元は `activity.image_url`）。http か https の URL だけで、ほかは `null`。画面は参照元のページの URL を送らずに出す（`referrerpolicy="no-referrer"`。plan.md の U5） |

### life event（`type: 'life_event'`、tasks.md の Phase 6 で足す）

| 項目 | 元の列 |
|---|---|
| `type` | `'life_event'` |
| `title` | `activity.title`（空なし。004 の FR-024） |
| `description` | `activity.description`（空あり） |
| `happenedOn` | `sort_at`（元は `activity.happened_on`） |
| `source` | `'life_event'` |
| `sourceKind` | `'life_event'` |
| `slug` | `activity.slug`。個別のページ `/life-events/{slug}` へのリンクに使う（plan.md の U4） |
| `imageUrl` | 代表画像を配る経路 `/life-events/{slug}/media/{card_storage_key}`（`routes.lifeEventMedia`）。無ければ `null`（plan.md の U5） |

## 検査

- 結合: 秘匿化した職歴・実績が並ぶ一覧の HTML と RSC の応答に、実際の題・実際の組織名・本文の中身・関連 URL・画像（代表画像と本文の画像）の URL が含まれない（SC-001）
- 結合: 代表画像を持つ実績・note・life event・外部の activity の画像が、上の `imageUrl` の URL で出る（plan.md の U5）
- 結合: サイトに載せない職歴・実績と学歴の値が、一覧の応答に含まれない（SC-005・SC-006）
- 結合: 下書き・削除した note と、公開した後に保存した版の内容が、一覧の応答に含まれない（SC-002）
- workerd: ビューと Repository の実装が、種類ごとの並びの日付と FR-010 の順で返す。2 回続けて読んだ順が同じ（SC-004）
- 単体: ビューの行から `FeedItem` への詰め替えが、種類ごとの項目だけを持つ
