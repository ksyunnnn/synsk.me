---

description: "一覧の実装タスク"
---

# Tasks: 一覧

**Input**: `specs/005-feed/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（公開できない値を訪問者へ出す経路を持たない）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US4）
- **止める依存: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない

## Contents

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1（P1）
- Phase 4: User Story 2（P1）
- Phase 5: User Story 3（P1）
- Phase 6: User Story 4（P2）
- Phase 7: Polish

---

## Phase 1: Setup

**Purpose**: ビューと検査の前提を用意する

- [x] T001 ビュー `activity_feed` を作る migrations/0025_create_activity_feed.sql を書く。列・行を出す条件・`sort_key` は data-model.md のとおり（research.md の R1・R3〜R6）
- [x] T002 [P] migration 0025 の後にビュー `activity_feed` があり、data-model.md の列だけを持つことを tests/workers/migrations.test.ts に足す（FR-012・FR-013 の列の許可リスト）

---

## Phase 2: Foundational

**Purpose**: DTO・ページの番号・Repository のインタフェース

- [x] T003 `FeedItem`（5 つの型）・`FeedPage`・ページの番号の読み方（`parseFeedPage`、1〜1,000）・1 ページの件数を src/features/activity/domain/feed.ts に作る（contracts/visitor-feed.md、research.md の R7）
- [x] T004 一覧の Repository のインタフェース `FeedRepository`（`listPage(page)`）を src/features/activity/domain/feed-repository.ts に作る
- [x] T005 [P] `parseFeedPage` と、ビューの行から `FeedItem` への詰め替え（日本時間の暦の日付、スキルの JSON、題の無い外部の activity）を tests/unit/feed.test.ts で確かめる（FR-018・FR-019）

---

## Phase 3: User Story 1 - 外部と synsk.me の中の活動を、1 つの並びで見る (Priority: P1)

**Goal**: 5 つの種類が、並びの日付の新しい順で 1 つの並びになる

**Independent Test**: 作り物の 5 種類を 1 件ずつ並びの日付をずらして入れ、`/timeline` に note・外部の activity・life event・実績・職歴の順で並ぶ

- [x] T006 [US1] ビューを読み、`ORDER BY sort_key DESC, type_rank ASC, item_id DESC` で 51 件を読み、DTO に詰める src/features/activity/server/d1-feed-repository.ts を作る（data-model.md の「並び」、research.md の R7）
- [x] T007 [US1] 5 種類が並びの日付で並ぶこと、note は作成日・実績と職歴は始まりの日で並ぶこと、同じ日付の組の順と 2 回読んで同じ順、同じ日の life event が外部の activity より後、日本時間の日の境目、学歴が並ばないこと、サイトに載せない実績・職歴が並ばないこと、ページ送り、1 回の読み取りのスキャン行数を tests/workers/feed-repository.test.ts で確かめる（FR-001〜FR-004・FR-007〜FR-011、SC-004〜SC-006、research.md の R13）
- [x] T008 [US1] `listFeed` のユースケースを src/features/activity/application/list-feed.ts に、組み立て用の関数を src/features/activity/server/deps.ts と src/features/activity/server/queries.ts に足す
- [x] T009 [US1] 一覧の部品を src/features/activity/components/feed.tsx に作る（種類の名前・日付・題・リンク・取得元・分類の属性、0 件と範囲の外の画面、次と前のページ。research.md の R9・R12）
- [x] T010 [US1] `/timeline` のページを src/app/timeline/page.tsx に作る（`instant = false`、メタデータ、research.md の R8・R12）

**Checkpoint**: `/timeline` に 5 種類が並ぶ

---

## Phase 4: User Story 2 - 秘匿化した職歴・実績を、出してよい値だけで並べる (Priority: P1)

**Goal**: 秘匿化した実績と職歴が、秘匿化した値だけで並ぶ

**Independent Test**: 本文・関連 URL を持つ秘匿化した実績と職歴を入れ、`/timeline` の応答に実際の題・実際の組織名・本文・URL が無い

- [x] T011 [US2] 秘匿化した実績と職歴の行が秘匿化した題と組織名を持ち、本文・URL が DTO に無いこと、秘匿化した組織名の無い組織を指す秘匿化した行が並ばないこと、秘匿化しない行が実際の値で並び、組織名を直すと直した名前になることを tests/workers/feed-repository.test.ts に足す（FR-012〜FR-014・FR-021・SC-001）
- [x] T012 [US2] 秘匿化した実績と職歴の本文の場所に「非公開」と出す見た目を src/features/activity/components/feed.tsx に足す（FR-013）
- [x] T013 [P] [US2] `/timeline` の HTML と RSC の応答に、秘匿化した実績と職歴の実際の題・実際の組織名・本文・関連 URL が 0 件で、`no-store` であることを tests/integration/feed.test.ts で確かめる（SC-001、NFR-09）

---

## Phase 5: User Story 3 - 公開の note だけを並べる (Priority: P1)

**Goal**: 公開で削除していない note だけが、公開した版の題で並ぶ

**Independent Test**: 下書き・公開・公開してから削除・公開してから下書きに戻した note を作り、公開の note だけが並ぶ

- [x] T014 [US3] 下書き・削除・下書きに戻した note が並ばないこと、公開した後に保存した版の題と説明文が並ばないことを tests/workers/feed-repository.test.ts に足す（FR-005・FR-006・FR-008・SC-002）
- [x] T015 [P] [US3] `/timeline` の HTML に下書きの note の題が 0 件であることを tests/integration/feed.test.ts に足す（SC-002）

---

## Phase 6: User Story 4 - 転載した note と、転載先から取り込んだ同じ記事を重ねない (Priority: P2)

**Goal**: 公開の note の転載先と一致する外部の activity が並ばない

**Independent Test**: 公開の note に転載先の URL を記録し、同じ URL の外部の activity を入れ、note だけが並ぶ

- [x] T016 [US4] 転載先と一致する外部の activity が並ばないこと、一致しないものは並ぶこと、転載元の note を下書きに戻すか削除すると並ぶことを tests/workers/feed-repository.test.ts に足す（FR-016・FR-017・SC-003）

---

## Phase 7: Polish

- [x] T017 [P] 5 種類が並ぶこと、外部の activity が取得元の URL へリンクすること、キーボードだけでリンクを辿れることを tests/e2e/feed.spec.ts で確かめる（FR-020、constitution V）
- [x] T018 `npm run lint`・`npm run format:check`・`npx tsc --noEmit`・4 段階の検査を通し、`bash .claude/skills/auditing-docs-convention/scripts/check.sh` の出力が無いことを確かめる
- [x] T019 T007 で測ったスキャン行数を検査に固定し、測り方を research.md の R13 に書く
- [ ] T020 PR の CI が 10 分以内に収まることを GitHub Actions のステップの所要時間で確かめる（ADR-0019）
- [ ] T021 quickstart.md の「手で確かめる」をブランチの Preview で行う
- [ ] T022 #208 がマージされた後に、職歴の行にスキルを出すかを決める。**止める依存: U9**

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2・US3・US4（どれも US1 のビューと Repository の検査に足す）
- Polish は全 User Story の後

## Parallel Example: User Story 1

```text
T001 migration → T002 migrations.test.ts
T003 feed.ts → T005 tests/unit/feed.test.ts
↓
T006 d1-feed-repository.ts → T007 tests/workers/feed-repository.test.ts
↓
T008 → T009 → T010
```

## Implementation Strategy

### MVP First

1. Phase 1・2
2. US1〜US3 をそろえる。秘匿化と公開の決まりはビューが持つため、US1 のビューで US2・US3 の決まりも満たし、US2・US3 の段階はその検査を足す

### Incremental Delivery

US1〜US3 → US4 → Polish。各段階を Preview で確かめてからマージする

## Notes

- 機能どうしは import しない（ADR-0026）。ビューが他の機能の表を読むのは SQL の中だけ
- 一覧は書き込みの経路を持たない
