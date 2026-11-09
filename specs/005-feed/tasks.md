---

description: "一覧の実装タスク"
---

# Tasks: 一覧

**Input**: `specs/005-feed/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: 最初の段階（Phase 3）を、001 の職歴と実績だけで一覧を通す細い 1 本（Walking Skeleton）にする。spec の User Story 1 と User Story 2 のうち、職歴と実績の部分を通す。note・外部の activity・life event・重なりの除外は、その読み口に足す段階に分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US4）
- **止める未決: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない
- **止める依存: M<n>**: 共有担当のビューの migration M<n>（data-model.md の「要る migration の変更」）が epic に入るまで着手しない

## Contents

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: 職歴と実績の細い 1 本（US1・US2 の職歴と実績の部分）
- Phase 4: User Story 3（note）
- Phase 5: ページ送りと読み取り行数
- Phase 6: User Story 1 の外部の activity と life event
- Phase 7: User Story 4（重なりの除外）
- Phase 8: Polish
- Dependencies & Execution Order
- Implementation Strategy

---

## Phase 1: Setup

**Purpose**: ビューの M1 が入ったスキーマで検査を回せることを確かめる

- [x] T001 共有担当の M1（ビュー `activity_feed` の職歴と実績の腕）が epic に入ったことを確かめ、`npm run test:workers` が通ることを確かめる。**止める依存: M1**

---

## Phase 2: Foundational

**Purpose**: 一覧の型と Repository のインタフェース。Phase 3 以降のすべてが使う

- [x] T002 [P] 種類の `as const` の配列 `FEED_ITEM_TYPES`（Phase 3 では実績・職歴の 2 つ。仮の順は note・外部の activity・life event・実績・職歴。plan.md の U2、data-model.md の「domain の型」）と、種類で分けた型 `FeedItem` の職歴と実績の分を src/features/activity/domain/feed.ts に作る（contracts/visitor-feed.md、research.md の R5・R6）
- [x] T003 [P] `FeedRepository`（`list()` が `FeedItem` の並びを返す。ページの引数は Phase 5 の T032 で足す）を src/features/activity/domain/feed-repository.ts に作る
- [x] T004 ユースケース `listFeed` を src/features/activity/application/list-feed.ts に作り、作り物の `FeedRepository` を渡して並びをそのまま返すことを tests/unit/list-feed.test.ts で確かめる

---

## Phase 3: 職歴と実績の細い 1 本（US1・US2 の職歴と実績の部分） 🎯 MVP

**Goal**: サイトに載せる職歴と実績が、始まりの日の新しい順で 1 つの並びになり、秘匿化したものは出してよい値だけで並ぶ。一覧の読み口（ビューの列・Repository・DTO・並べる順）が決まる

**Independent Test**: 作り物の組織・職歴・実績・学歴を、秘匿化するか・サイトに載せるかを変えて入れる。一覧の応答に、載せる職歴と実績だけが始まりの日の順で並び、秘匿化した実際の値と学歴が無いことを確かめる

### Tests

- [x] T010 [P] [US2] ビューの行から `FeedItem` への詰め替えが、職歴は種類・秘匿化するか・組織名・肩書・期間だけを、実績は種類・秘匿化するか・題・組織名・実績の種類・期間だけを持ち、`item_number` を持たないことを tests/unit/feed.test.ts で確かめる（FR-012・FR-013、contracts/visitor-feed.md）
- [x] T011 [P] [US1] 本物の migration を当てた D1 で、`list` が次を満たすことを tests/workers/feed-repository.test.ts で確かめる。**止める依存: M1**
  - サイトに載せる職歴と実績が始まりの日の新しい順に並び、終わりの日を使わない（FR-007・FR-009、US1 の Acceptance 3）
  - 終わりの日が空の職歴・実績も始まりの日で並ぶ（Edge Cases）
  - 同じ始まりの日の職歴と実績が `FEED_ITEM_TYPES` の順と主キーの順で並び、2 回続けて読んだ順が同じ（FR-010）
  - サイトに載せない職歴・実績が、秘匿化するかに関わらず並ばない（FR-004、US1 の Acceptance 7）
  - 秘匿化した行は秘匿化した題と秘匿化した組織名で並び、DTO に実際の値が入らない。Repository は `is_masked` で `_masked` の列か実際の値の列かを選ぶ。秘匿化した組織名の無い組織を指す秘匿化した行は並ばない（FR-012、US2 の Acceptance 1、research.md の R4）
  - 学歴が並ばない（FR-001）
  - `FEED_ITEM_TYPES` に無い種類の行がビューにあっても、`list` はその行を返さない（data-model.md の「アプリケーションが守る決まり」）
- [ ] T012 [P] [US2] 本番ビルドに対して、一覧の HTML と RSC の応答を tests/integration/feed.test.ts で確かめる。**止める依存: M1**。**止める未決: U1**
  - 秘匿化した実績と職歴（本文・関連 URL・代表画像を入れる）の実際の題・実際の組織名・本文の中身・関連 URL・画像の URL が含まれない（SC-001、US2 の Acceptance 2・3）
  - 秘匿化した行の本文の場所に「非公開」が出る（FR-013）
  - 秘匿化しない実績が実際の題と実際の組織名で並ぶ（FR-014、US2 の Acceptance 4）
  - 組織名を直した直後の要求で、秘匿化しない職歴と実績が直した組織名で並ぶ（FR-021、US2 の Acceptance 5）
  - サイトに載せない職歴・実績と学歴の値が含まれない（SC-005・SC-006、US1 の Acceptance 6・7）
  - 並ぶ activity が 0 件のとき、200 で 0 件の表示が出る（NFR-02）

### Implementation

- [x] T013 [US1] `createD1FeedRepository` を src/features/activity/server/d1-feed-repository.ts に作る。ビュー `activity_feed` から職歴と実績の列を列挙して SELECT し、`WHERE item_type IN (<FEED_ITEM_TYPES>)` と `ORDER BY sort_at DESC, <FEED_ITEM_TYPES から作る CASE>, item_number DESC` で読み、種類ごとに `FeedItem` に詰める（research.md の R4・R5）。表の行の型はこのファイルの中だけに書く
- [x] T014 [US1] 組み立て用の関数 `listFeedItems` を src/features/activity/server/feed-queries.ts に作る（ADR-0030）。先頭で `import 'server-only'`
- [x] T015 [US2] 一覧の部品を src/features/activity/components/feed.tsx に作る。職歴と実績の行を種類ごとに見せ、秘匿化した行の本文の場所に「非公開」を出す（001 の spec の FR-021）。React の key は並びの位置で付ける（research.md の R6）。0 件の表示を持つ
- [ ] T016 [US1] 一覧の画面の `page.tsx` を、U1 の URL の下の src/app/ に作る。`export const instant = false` で D1 を `<Suspense>` の外で読み、`loading.tsx` を置かない。`'use cache'`・`revalidate`・`dynamic` を書かない（research.md の R9）。U1 が `/` なら src/app/page.tsx を置き換え、`/` を開く tests/e2e/home.spec.ts・tests/e2e/no-js.spec.ts・tests/integration/routes.test.ts を直す。**止める未決: U1**
- [ ] T017 `npm test`・`npm run test:workers`・`npm run test:integration`・`npx tsc --noEmit`・`npm run lint`・`npm run format:check` が通ることを確かめる

**Checkpoint**: 職歴と実績だけの一覧が Preview で見られる（quickstart.md の 1〜5）

---

## Phase 4: User Story 3（note）

**Goal**: 公開で削除していない note が、公開した版の題と説明文で、作成日の位置に並ぶ

**Independent Test**: 下書き・公開・公開してから削除・公開してから下書きに戻した note を 1 件ずつ入れ、一覧の応答に公開の note だけが公開した版の題で並ぶことを確かめる

### Tests

- [x] T020 [P] [US3] note の詰め替えが題・説明文・作成日だけを持つことを tests/unit/feed.test.ts に足す（FR-006、contracts/visitor-feed.md）
- [x] T021 [P] [US3] 本物の migration を当てた D1 に note と版の行を直接入れ、tests/workers/feed-repository.test.ts に次を足す。**止める依存: M2**
  - 下書き・削除・下書きに戻した note が並ばない（FR-005、US3 の Acceptance 1〜3）
  - 公開した後に題を直して保存した note が、公開した版の題と説明文で並ぶ（FR-006、US3 の Acceptance 4）
  - 2020-01-15 に作り 2025-03-01 に初めて公開した note が 2020-01-15 の位置に並び、公開し直しても・下書きに戻してから公開に戻しても位置が変わらない（FR-007・FR-008、US1 の Acceptance 2）
  - note と職歴・実績が並びの日付の新しい順に並ぶ（FR-007）。同じ日の組は U3 が解けてから Phase 6 の T042 で確かめる
- [ ] T022 [P] [US3] 下書き・削除した note と、公開した後に保存した版の題が、一覧の HTML と RSC の応答に含まれないことを tests/integration/feed.test.ts に足す（SC-002）。**止める依存: M2**。**止める未決: U1**

### Implementation

- [x] T023 [US3] `FEED_ITEM_TYPES` と `FeedItem` に note を足す（src/features/activity/domain/feed.ts）
- [x] T024 [US3] src/features/activity/server/d1-feed-repository.ts の SELECT と詰め替えに note の列（`title`・`description`・`sort_at`）を足す
- [x] T025 [US3] src/features/activity/components/feed.tsx に note の行を足す。個別のページへのリンクは付けない（plan.md の U4）

**Checkpoint**: 職歴・実績・note の一覧

---

## Phase 5: ページ送りと読み取り行数

**Purpose**: ADR-0046 の Confirmation として D1 で一覧の読み取り行数を測り、外部の activity で行が増える前に 1 ページの件数を決めて区切る（research.md の R8）

- [ ] T030 職歴・実績・note・外部の activity・life event を作り物の行（外部の activity 500 件、ほかの種類は各 50 件）入れた D1 で、1 ページ目を読む文の `meta.rows_read` と所要時間を測る。値と件数を research.md の R8 に書く。測った値が遅いことを示し、写して持つ形に移す必要があれば、ADR-0046 を覆すことになるので PM に伝えて止める。**止める依存: M3**（外部の activity と life event の腕が無いと、その行を読む量を測れない）
- [ ] T031 [P] 番号のページ（`?page=n`）で区切り、最後のページの先で項目を返さないことを tests/workers/feed-repository.test.ts に足す（research.md の R8）。**止める依存: M3**（件数は T030 で決まる）
- [ ] T032 src/features/activity/server/d1-feed-repository.ts の `list` にページの引数と `LIMIT`・`OFFSET` を足し（src/features/activity/domain/feed-repository.ts のインタフェースも直す）、件数を src/features/activity/domain/feed.ts の定数に置く。**止める依存: M3**（件数は T030 で決まる）
- [ ] T033 src/features/activity/components/feed.tsx に次のページへのリンクを足し、一覧の画面が `page` の問い合わせの値を読む。数でない値と 1 より小さい値は 1 ページ目として読む。最後のページの先では「まだ何もない」を出さず、1 ページ目へのリンクを出す。ページ送りは `<a>` で作る。リンクに主キーを含めないことを tests/integration/feed.test.ts で確かめる（ADR-0048）。**止める依存: M3**。**止める未決: U1**

---

## Phase 6: User Story 1 の外部の activity と life event

**Goal**: 外部の activity と life event が、公開日と起きた日の位置に、取得元と分類が分かる形で並ぶ。外部の activity は取得元の URL へリンクする

**Independent Test**: 作り物の外部の activity・life event・公開の note・実績・職歴を 1 件ずつ並びの日付をずらして入れ、5 件が新しい順に並び、それぞれの種類が分かることを確かめる（US1 の Independent Test）

### Tests

- [ ] T040 [P] [US1] 外部の activity の詰め替えが題・URL・公開日・取得元・分類だけを、life event の詰め替えが題・説明・起きた日・取得元・分類だけを持つことを tests/unit/feed.test.ts に足す（FR-018・FR-019、contracts/visitor-feed.md）
- [ ] T041 [P] [US1] 本物の migration を当てた D1 に activity の行を直接入れ、tests/workers/feed-repository.test.ts に次を足す。**止める依存: M3**
  - US1 の Acceptance 1 の 5 件が、note・外部の activity・life event・実績・職歴の順に並ぶ
  - 分類が埋め込みの取得元の外部の activity が、種類・分類・取得元を持って並ぶ（US1 の Acceptance 4）。分類が埋め込みの取得元は 0012 が入れた行（例: `speakerdeck`）を使い、検査の中で `activity_source` に行を足さない
  - 保存した life event がすべて並ぶ（FR-003）
  - 行を消した外部の activity は並ばない（FR-002。消すのは 004）
- [ ] T042 [US1] 種類をまたいで同じ日の組を含む検査用のデータで、順が手で並べた順と一致し、2 回続けて読んだ順が同じこと（SC-004）と、同じ日の life event が外部の activity より古い位置に並ぶこと（FR-011）を tests/workers/feed-repository.test.ts に足す。**止める依存: M3**。**止める未決: U3**
- [ ] T043 [P] [US1] 外部の activity の行が取得元の URL へのリンクを持つことを tests/integration/feed.test.ts に足す（FR-020、US1 の Acceptance 5）。**止める依存: M3**。**止める未決: U1**

### Implementation

- [ ] T044 [US1] `FEED_ITEM_TYPES` と `FeedItem` に外部の activity と life event を足す（src/features/activity/domain/feed.ts）
- [ ] T045 [US1] src/features/activity/server/d1-feed-repository.ts の SELECT と詰め替えに外部の activity と life event の列（`title`・`description`・`url`・`source`・`source_kind`・`sort_at`）を足す
- [ ] T046 [US1] src/features/activity/components/feed.tsx に外部の activity と life event の行を足す。外部の activity は `<a>` で取得元の URL へリンクする（`src/shared/components/text-link.tsx` は管理画面の移動のための `next/link` なので使わない）。分類ごとに見せ方を分けられる形にし、埋め込みの見せ方は取得元で決める（FR-019）。代表の画像は出さない（plan.md の U5）

**Checkpoint**: 5 つの種類の一覧（quickstart.md の 6 の前半）

---

## Phase 7: User Story 4（重なりの除外）

**Goal**: 公開の note の転載先と同じ URL の外部の activity が並ばない

**Independent Test**: 公開の note に転載先の URL を記録し、同じ URL の外部の activity を入れる。一覧に note が並び、その外部の activity が並ばないことを確かめる

- [ ] T050 [US4] tests/workers/feed-repository.test.ts に次を足す。**止める依存: M4**
  - 公開の note の転載先と同じ URL の外部の activity が並ばず、note は並ぶ（FR-016、SC-003、US4 の Acceptance 1）
  - 転載先と一致しない外部の activity は並ぶ（FR-017、US4 の Acceptance 2）
  - 転載先を記録した note を下書きに戻すか削除すると、同じ URL の外部の activity が並ぶ（FR-016、US4 の Acceptance 3）
  - 一致は文字列の完全一致（plan.md の U6）

**Checkpoint**: spec の User Story 1〜4 がそろう（quickstart.md の 6）

---

## Phase 8: Polish

- [ ] T060 ブランチの Preview で quickstart.md の手順を行う
- [ ] T061 `bash .claude/skills/auditing-docs-convention/scripts/check.sh` の出力が空であることを確かめる
- [ ] T062 U2・U4〜U7 が決まったら、`FEED_ITEM_TYPES`・DTO・部品を直すタスクを足す

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8
- 「止める未決」「止める依存」の印の付いたタスクは、印の付かないタスクを止めない。U1 が解けるまでは、画面（T016）と結合の検査（T012・T022・T033・T043）を除いて進める
- Phase 4 と Phase 6 は 003・004 のコードを待たない。表（0004・0005）に作り物の行を入れて確かめる（plan.md の「spec どうしの重なり」）
- Phase 5 は Phase 6 の前に置く。外部の activity で行が増える前に区切るため。T030 の計測は M3 を待つので、M3 が入ってから Phase 5 と Phase 6 の検査を始める

### User Story Dependencies

- Phase 3（US1・US2 の職歴と実績）: Phase 2 と M1
- Phase 4（US3）: Phase 3 と M2
- Phase 5（ページ送り）: Phase 4 と M3
- Phase 6（US1 の外部の activity と life event）: Phase 5 と M3
- Phase 7（US4）: Phase 6 と M4

### 未決と依存が止めるタスク

| 未決・依存 | 止めるタスク |
|---|---|
| U1 | T012・T016・T022・T033・T043 |
| U3 | T042 |
| M1 | T001・T011・T012 |
| M2 | T021・T022 |
| M3 | T030〜T033・T041・T042・T043 |
| M4 | T050 |

### Within Each Phase

- 検査を先に書き、落ちることを確かめてから実装する
- domain → server → components → app の順

### Parallel Opportunities

- Phase 2: T002・T003 は別のファイル
- 各段階の検査（単体・workerd・結合）は別のファイルで並べられる

## Parallel Example: Phase 3

```text
T010 tests/unit/feed.test.ts
T011 tests/workers/feed-repository.test.ts
T012 tests/integration/feed.test.ts
↓
T013 src/features/activity/server/d1-feed-repository.ts
T014 src/features/activity/server/feed-queries.ts
T015 src/features/activity/components/feed.tsx
T016 src/app/{U1 の URL}/page.tsx
```

## Implementation Strategy

### MVP First

1. Phase 1・Phase 2
2. Phase 3 で、職歴と実績だけの一覧を通す。ビューの列・Repository・DTO・並べる順がここで決まり、Phase 4 以降はこの形に足す
3. Phase 3 の後に、決まった読み口を PM に伝える。003・004 の担当が、ビューが読む列の意味を変えないことを確かめる

### Incremental Delivery

Phase 3（職歴と実績）→ Phase 4（note）→ Phase 5（ページ送り）→ Phase 6（外部の activity と life event）→ Phase 7（重なりの除外）→ Polish。各段階を Preview で確かめてから epic に入れる

## Notes

- 機能どうしは import しない（ADR-0026）。一覧は `src/features/project`・`career`・`note` を import せず、ビューだけを読む
- 005 は migration と ER 図を変えない。要る変更は PM に伝える
- 004 と同じ `src/features/activity/` に置くので、ファイル名に一覧の名前を付けて分ける
- コミットはタスクか論理のまとまりごと
