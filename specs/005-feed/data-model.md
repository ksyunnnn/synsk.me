# Data Model: 一覧

表・列・型・CHECK の正本は `migrations/` にある。005 は表を持たず、001・003・004 の表を、共有担当が書く一覧のビュー `activity_feed` で読む（research.md の R1・R2、ADR-0046）。この文書は、ビューに要る列と腕の条件を spec の要件に対応させる。SQL の全文は migration が持つ。

## Contents

- 読む表と spec の対応
- 一覧のビュー
- 要る migration の変更
- アプリケーションが守る決まり
- domain の型

---

## 読む表と spec の対応

| 表 | spec の実体 | 005 が書くか | 主な要件 |
|---|---|---|---|
| `career`・`organization` | 職歴 | 書かない | FR-004・FR-009・FR-012〜FR-014・FR-021 |
| `project`・`organization` | 実績 | 書かない | FR-004・FR-009・FR-012〜FR-014・FR-021 |
| `note`・`note_revision` | note | 書かない | FR-005・FR-006・FR-008 |
| `activity`・`activity_source`（`source <> 'life_event'`） | 外部の activity | 書かない | FR-002・FR-007・FR-019・FR-020 |
| `activity`・`activity_source`（`source = 'life_event'`） | life event | 書かない | FR-003・FR-007・FR-019 |
| `syndication` | 転載先 | 書かない | FR-016・FR-017 |
| `education` | 学歴 | 読まない | FR-001 |

## 一覧のビュー

ビュー `activity_feed` は、種類ごとの腕を UNION ALL でつなぐ。公開側の一覧はこのビューだけを読む（ADR-0046）。

### 列

| 列 | 意味 | 足す migration |
|---|---|---|
| `item_type` | 種類。`career`・`project`・`note`・`external_activity`・`life_event` | M1 |
| `item_id` | 種類ごとの元の行の主キー。並べる SQL の中だけで使い、DTO に入れない | M1 |
| `sort_key` | 並びの日付。暦の日付（`YYYY-MM-DD`）か日時（`YYYY-MM-DDTHH:MM:SS.sssZ`）の文字列 | M1 |
| `is_masked` | 秘匿化した職歴・実績なら 1。ほかは 0 | M1 |
| `title` | 実績・note・外部の activity・life event の題。秘匿化した実績は `title_masked` | M1 |
| `organization_name` | 職歴・実績の組織名。秘匿化した行は `organization.name_masked` | M1 |
| `role` | 職歴の肩書 | M1 |
| `project_kind` | 実績の種類（`project.kind`） | M1 |
| `started_on`・`ended_on` | 職歴・実績の期間 | M1 |
| `description` | note の公開した版の説明文、life event の説明 | M2 |
| `source`・`source_kind` | 外部の activity と life event の取得元と分類（`activity_source.kind`） | M3 |
| `url` | 外部の activity の取得元の URL | M3 |

列の名前は `docs/SOFTWARE_DESIGN.md` の「列の名前を意味ごとに1つにする」に従う。種類は `kind` と呼ばない。`project.kind`（実績の種類）と `activity_source.kind`（分類）が別の意味で使っているため。

腕ごとに同じ位置の列の型を揃え、使わない列は型を揃えた `NULL` を置く（research.md の R3）。

### 腕

| 腕 | 読む行 | `sort_key` | 秘匿化 | migration |
|---|---|---|---|---|
| 職歴 | `career.status = 'published'` で、`is_masked = 0` か、組織が `name_masked` を持つ | `career.started_on` | `is_masked = 1` なら `organization_name` は `name_masked`。`description`・`url` は出さない | M1 |
| 実績 | `project.status = 'published'` で、`is_masked = 0` か、組織が `name_masked` を持つ | `project.started_on` | `is_masked = 1` なら `title` は `title_masked`、`organization_name` は `name_masked`。`description`・`url`・`card_media_id` は出さない | M1 |
| note | `note.status = 'published' AND note.deleted_at IS NULL`。題と説明文は `note.published_revision_id` の版 | `note.created_at` | — | M2 |
| 外部の activity | `activity.source <> 'life_event'` で、公開で削除していない note の `syndication.url` と `activity.url` が一致しない | `activity.sort_at` | — | M3（除外は M4） |
| life event | `activity.source = 'life_event'` のすべて | `activity.sort_at` | — | M3 |

取得元で消えたと確かめた外部の activity は、004 が行を消す（004 の research.md の R6）。外部の activity の腕は、消えた行を除く条件を持たない（FR-002）。

## 要る migration の変更

005 は migration を書かない。共有担当に渡す変更は次のとおり。番号とファイル名は共有担当が付ける。

| migration | 変更 | 待つ段階（tasks.md） |
|---|---|---|
| M1 | ビュー `activity_feed` を作る。職歴と実績の腕と、M1 の列 | Phase 3（職歴と実績の細い 1 本） |
| M2 | ビューを作り直し、note の腕と `description` を足す | Phase 4（note） |
| M3 | ビューを作り直し、外部の activity と life event の腕と、`source`・`source_kind`・`url` を足す | Phase 6（外部の activity と life event） |
| M4 | ビューを作り直し、外部の activity の腕に転載先と一致する行の除外を足す | Phase 7（重なりの除外） |

ER 図（`gen_er8.py`・`er-options.html`）にビューを載せるかは共有担当が決める。

## アプリケーションが守る決まり

ビューに無く、Repository の実装かユースケースが守る決まり。

| 決まり | 要件 | 置き場 |
|---|---|---|
| 並べる順は `sort_key` の新しい順、種類の順、`item_id` の大きい順 | FR-010 | `src/features/activity/server/d1-feed-repository.ts` の `ORDER BY`。種類の順は `src/features/activity/domain/feed.ts` の配列（research.md の R5） |
| 種類ごとに出す項目を列挙して DTO に詰める。`item_id` を詰めない | FR-012・FR-013・FR-015 | `src/features/activity/server/d1-feed-repository.ts`（contracts/visitor-feed.md） |
| 秘匿化した職歴・実績の本文は、伏せた見た目で出す | FR-013 | `src/features/activity/components/feed.tsx` が `isMasked` を見て決まった文字を出す |
| ページ送りは番号のページで区切る | spec の Assumptions | `src/features/activity/server/d1-feed-repository.ts`。件数は測ってから決める（research.md の R8） |

## domain の型

`src/features/activity/domain/feed.ts` に置く。

- `FEED_ITEM_TYPES`: `career`・`project`・`note`・`external_activity`・`life_event` の `as const` の配列。並びの日付が同じときの種類の順を兼ねる（仮の順。plan.md の U2）
- `FeedItemType`: `FEED_ITEM_TYPES` から作る型
- `FeedItem`: 種類で分けた型。項目は [contracts/visitor-feed.md](./contracts/visitor-feed.md) が持つ
- `FeedRepository`（`src/features/activity/domain/feed-repository.ts`）: `list(page)` が `FeedItem` の並びを返す
- 職歴と実績の期間は `src/shared/domain/period.ts` の `Period` を使う
- 表の行の型は `server/d1-feed-repository.ts` の中だけで書く（001 の research.md の R3）
