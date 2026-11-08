# Data Model: 一覧

一覧は表を持たない。ビュー `activity_feed`（`migrations/0025_create_activity_feed.sql`）が元の表を UNION ALL でつなぐ（research.md の R1）。列の定義の正本は migration が持ち、ここは決まりと、どの元の列から作るかを置く。

## ビュー activity_feed

1 行が一覧の 1 件（spec の Terms の activity）。訪問者に出してよい値だけを列に持つ（research.md の R3・R5）。

| 列 | note | 外部の activity | life event | 実績 | 職歴 |
|---|---|---|---|---|---|
| `item_type` | `'note'` | `'external_activity'` | `'life_event'` | `'project'` | `'career'` |
| `item_id` | `note.id` | `activity.id` | `activity.id` | `project.id` | `career.id` |
| `type_rank` | 1 | 2 | 3 | 4 | 5 |
| `sort_key` | `note.created_at` を日本時間に | `activity.published_at` を日本時間に | `activity.happened_on` | `project.started_on` | `career.started_on` |
| `slug` | `note.slug` | NULL | `activity.slug` | `project.slug` | NULL |
| `url` | NULL | `activity.url` | NULL | NULL | NULL |
| `visible_title` | 公開した版の `note_revision.title` | `activity.title` | `activity.title` | 秘匿化なら `project.title_masked`、でなければ `project.title` | NULL |
| `description` | 公開した版の `note_revision.description` | NULL | NULL | NULL | NULL |
| `source` | NULL | `activity.source` | `activity.source` | NULL | NULL |
| `source_kind` | NULL | `activity_source.kind` | `activity_source.kind` | NULL | NULL |
| `visible_organization_name` | NULL | NULL | NULL | 秘匿化なら `organization.name_masked`、でなければ `organization.name` | 同じ |
| `role` | NULL | NULL | NULL | NULL | `career.role` |
| `project_kind` | NULL | NULL | NULL | `project.kind` | NULL |
| `started_on` | NULL | NULL | NULL | `project.started_on` | `career.started_on` |
| `ended_on` | NULL | NULL | NULL | `project.ended_on` | `career.ended_on` |
| `is_masked` | 0 | 0 | 0 | `project.is_masked` | `career.is_masked` |
| `skills` | NULL | NULL | NULL | つないだスキルの名前の JSON 配列（名前の順） | NULL |

`sort_key` の日本時間の形は `YYYY-MM-DDTHH:MM:SS.SSS`（research.md の R4）。

### ビューが持たない列

`note` の下書きの版、`note.deleted_at`、`project.description`・`project.url`・`project.card_media_id`、`career.description`・`career.url`、`activity.image_url`・`activity.description`・`activity.card_media_id`、`education` のすべての列、`uid`。

### 行を出す条件

| 種類 | 条件 | 要件 |
|---|---|---|
| note | `status = 'published'` かつ `deleted_at IS NULL` | FR-005 |
| 外部の activity | `source <> 'life_event'`。かつ、公開で削除していない note の `syndication.url` と `activity.url` が一致しない | FR-002・FR-016・FR-017 |
| life event | `source = 'life_event'` | FR-003 |
| 実績・職歴 | `status = 'published'`。かつ、`is_masked = 0` か `organization.name_masked IS NOT NULL` | FR-004、001 の plan.md の U2 |

## 並び

`ORDER BY sort_key DESC, type_rank ASC, item_id DESC`（FR-010・FR-011、research.md の R4）。並びは Repository の SQL が持つ。ビューの中には書かない（SQLite はビューの ORDER BY を外の問い合わせで保つと約束しない）。

## DTO

`src/features/activity/domain/feed.ts` の `FeedItem` は `item_type` で分かれる。各型が出す項目は [contracts/visitor-feed.md](./contracts/visitor-feed.md) が持つ。
