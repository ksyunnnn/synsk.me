# Data Model: 一覧

表・列・型・CHECK の正本は `migrations/` にある。005 は表を持たず、001・003・004 の表を、一覧のビュー `activity_feed` で読む（research.md の R1・R2、ADR-0046）。この文書は、ビューに要る列と腕の条件を spec の要件に対応させる。SQL の全文は migration が持つ。

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
| `item_number` | 種類ごとの元の行の主キー。並べる SQL の中だけで使い、DTO に入れない。外部キーではないので `_id` を付けない | M1 |
| `sort_at` | 並びの日付。暦の日付（`YYYY-MM-DD`）か、日時を Asia/Tokyo の時刻にした文字列（`YYYY-MM-DDTHH:MM:SS.sss`。末尾に `Z` を付けない）。時点ではないので、並べる SQL の中だけで使う。暦の日付は文字列の比べ方で同じ日の日時より小さく、新しい順の一覧では同じ日の日時より古い位置に並ぶ（`activity.sort_at` と同じ並び方、FR-011） | M1（日時の換算は M5） |
| `is_masked` | 秘匿化した職歴・実績なら 1。ほかは 0 | M1 |
| `title` | 秘匿化しない実績・note・外部の activity・life event の題。秘匿化した実績と職歴は `NULL` | M1 |
| `title_masked` | 秘匿化した実績の `project.title_masked`。ほかの行は `NULL` | M1 |
| `organization_name` | 秘匿化しない職歴・実績の `organization.name`。秘匿化した行とほかの種類は `NULL` | M1 |
| `organization_name_masked` | 秘匿化した職歴・実績の `organization.name_masked`。ほかの行は `NULL` | M1 |
| `role` | 職歴の肩書 | M1 |
| `project_kind` | 実績の種類（`project.kind`） | M1 |
| `started_on`・`ended_on` | 職歴・実績の期間 | M1 |
| `description` | note の公開した版の説明文、life event の説明 | M2 |
| `source`・`source_kind` | 外部の activity と life event の取得元と分類（`activity_source.kind`） | M3 |
| `url` | 外部の activity の取得元の URL | M3 |
| `created_at` | note の作成日時（`note.created_at`。UTC の時点）。ほかの行は `NULL` | M5 |
| `published_at` | 外部の activity の公開日時（`activity.published_at`。UTC の時点）。ほかの行は `NULL` | M5 |
| `slug` | 個別のページの識別子。実績は `project.slug`（秘匿化した実績を含む）、note は `note.slug`、life event は `activity.slug`。職歴と外部の activity は `NULL`（plan.md の U4） | M6 |

列の名前は `docs/SOFTWARE_DESIGN.md` の「列の名前を意味ごとに1つにする」に従う。種類は `kind` と呼ばない。`project.kind`（実績の種類）と `activity_source.kind`（分類）が別の意味で使っているため。

実際の値と秘匿化した値を同じ列に混ぜない。秘匿化した値の列は `_masked` で終える（`docs/SOFTWARE_DESIGN.md` の「列の名前を意味ごとに1つにする」）。秘匿化した行では実際の値の列が `NULL` なので、Repository が `is_masked` を読み違えても実際の値は画面へ渡らない。

腕ごとに同じ位置の列の型を揃え、使わない列は型を揃えた `NULL` を置く（research.md の R3）。

### 腕

| 腕 | 読む行 | `sort_at` | 秘匿化 | migration |
|---|---|---|---|---|
| 職歴 | `career.status = 'published'` で、`is_masked = 0` か、組織が `name_masked` を持つ | `career.started_on` | `is_masked = 1` なら `organization_name` は `NULL`、`organization_name_masked` は `name_masked`。`description`・`url` は出さない | M1 |
| 実績 | `project.status = 'published'` で、`is_masked = 0` か、組織が `name_masked` を持つ | `project.started_on` | `is_masked = 1` なら `title`・`organization_name` は `NULL`、`title_masked`・`organization_name_masked` に秘匿化した値。`description`・`url`・`card_media_id` は出さない | M1 |
| note | `note.status = 'published' AND note.deleted_at IS NULL`。題と説明文は `note.published_revision_id` の版 | `note.created_at` を Asia/Tokyo の時刻にした値 | — | M2（換算は M5） |
| 外部の activity | `activity.source <> 'life_event'` で、公開で削除していない note の `syndication.url` と `activity.url` が一致しない | `activity.published_at` を Asia/Tokyo の時刻にした値 | — | M3（除外は M4、換算は M5） |
| life event | `activity.source = 'life_event'` のすべて | `activity.sort_at` | — | M3 |

取得元で消えたと確かめた外部の activity は、004 が行を消す（004 の research.md の R6）。外部の activity の腕は、消えた行を除く条件を持たない（FR-002）。

## 要る migration の変更

M1〜M5 は共有担当が書いた。M6（migrations/0026）は、2026-11-11 の U4 の決定（[issue #219 のコメント](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6784129166)）を満たすため、005 が書き、PM が承認した。変更は次のとおり。

| migration | 変更 | 待つ段階（tasks.md） |
|---|---|---|
| M1 | ビュー `activity_feed` を作る。職歴と実績の腕と、M1 の列 | Phase 3（職歴と実績の細い 1 本） |
| M2 | ビューを作り直し、note の腕と `description` を足す | Phase 4（note） |
| M3 | ビューを作り直し、外部の activity と life event の腕と、`source`・`source_kind`・`url` を足す | Phase 6（外部の activity と life event） |
| M4 | ビューを作り直し、外部の activity の腕に転載先と一致する行の除外を足す | Phase 7（重なりの除外） |
| M5 | ビューを作り直し、note と外部の activity の `sort_at` を Asia/Tokyo の時刻にし、`created_at`・`published_at` を足す（plan.md の U3 の決定、research.md の R5）。migrations/0022 | Phase 6 の T042 |
| M6 | ビューを作り直し、`slug` を足す（plan.md の U4 の決定）。migrations/0026 | Phase 9 の T066 |

ER 図（`gen_er8.py`・`er-options.html`）にビューを載せるかは共有担当が決める。

## アプリケーションが守る決まり

ビューに無く、Repository の実装かユースケースが守る決まり。

| 決まり | 要件 | 置き場 |
|---|---|---|
| `item_type` が `FEED_ITEM_TYPES` にある行だけを読む。腕を足す migration が、その種類を詰める実装より先に入っても、一覧は詰められる種類だけで成り立つ | NFR-02 | `src/features/activity/server/d1-feed-repository.ts` の `WHERE` |
| 並べる順は `sort_at` の新しい順、種類の順、`item_number` の大きい順 | FR-010 | `src/features/activity/server/d1-feed-repository.ts` の `ORDER BY`。種類の順は `src/features/activity/domain/feed.ts` の配列（research.md の R5） |
| 種類ごとに出す項目を列挙して DTO に詰める。職歴・実績の題と組織名は、`is_masked` が 1 なら `_masked` の列から、0 なら実際の値の列から詰める。`item_number` を詰めない | FR-012・FR-013・FR-015 | `src/features/activity/server/d1-feed-repository.ts`（contracts/visitor-feed.md） |
| 秘匿化した職歴・実績の本文は、伏せた見た目で出す | FR-013 | `src/features/activity/components/feed.tsx` が `isMasked` を見て決まった文字を出す |
| ページ送りは番号のページで区切る | spec の Assumptions | `src/features/activity/server/d1-feed-repository.ts`。件数は測ってから決める（research.md の R8） |

## domain の型

`src/features/activity/domain/feed.ts` に置く。

- `FEED_ITEM_TYPES`: Repository の実装が詰められる種類の `as const` の配列。並びの日付が同じときの種類の順を兼ね、仮の順は `note`・`external_activity`・`life_event`・`project`・`career`（plan.md の U2）。Phase 3 は `project`・`career`、Phase 4 で `note`、Phase 6 で `external_activity`・`life_event` を、仮の順の位置に足す
- `FeedItemType`: `FEED_ITEM_TYPES` から作る型
- `FeedItem`: 種類で分けた型。項目は [contracts/visitor-feed.md](./contracts/visitor-feed.md) が持つ
- `FeedRepository`（`src/features/activity/domain/feed-repository.ts`）: `list` が `FeedItem` の並びを返す。ページの引数は tasks.md の Phase 5 で足す
- note の作成日はビューの `created_at`、外部の activity の公開日は `published_at` から詰める。`sort_at` は Asia/Tokyo の時刻にした並びの値で、時点として詰めない。life event の起きた日は `sort_at`（換算しない暦の日付）から詰める
- 職歴と実績の期間は `src/shared/domain/period.ts` の `Period` を使う
- 表の行の型は `server/d1-feed-repository.ts` の中だけで書く（001 の research.md の R3）
