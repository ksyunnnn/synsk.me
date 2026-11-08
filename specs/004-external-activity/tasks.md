---

description: "外部 activity の取得の実装タスク"
---

# Tasks: 外部 activity の取得

**Input**: `specs/004-external-activity/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（書き込みの経路に、オーナー以外が通れないことの検査を書く）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US5）
- **止める依存: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない

## Contents

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1（P1）
- Phase 4: User Story 2（P1）
- Phase 5: User Story 3（P1）
- Phase 6: User Story 4（P2）
- Phase 7: User Story 5（P2）
- Phase 8: Polish
- Dependencies & Execution Order
- Implementation Strategy

---

## Phase 1: Setup

**Purpose**: 表と取得元の行と入口を用意する

- [x] T001 `activity` を作り直して `uid` を足す migrations/0020_add_uid_to_activity.sql を書く。形・DEFAULT・書き換えを拒むトリガは 0011 と同じ。0004 の索引とトリガ、0009 の `slug` の CHECK と部分 UNIQUE 索引を作り直す（research.md の R1）
- [x] T002 外部の取得元 12 行を入れる migrations/0021_insert_activity_sources.sql を書く（research.md の R3）
- [x] T003 [P] migration 0020・0021 の後の表を tests/workers/migrations.test.ts に足す（`activity.uid` の NOT NULL・DEFAULT・書き換えの拒否、取得元の行と分類）
- [x] T004 [P] D1 に作り物の activity・life event・取得の結果の行を入れる道具を tests/support/activity-rows.ts に作る
- [x] T005 `GITHUB_TOKEN`・`QIITA_ACCESS_TOKEN`・`CONNPASS_API_KEY` の型 `ActivityEnv` を src/shared/server/env.ts に足し、`.dev.vars.example` に雛形を足す

---

## Phase 2: Foundational

**Purpose**: 取得元の一覧・詰め替えの型・Repository のインタフェース

- [x] T006 取得元・分類・取り込み方の一覧を src/features/activity/domain/source.ts に作る（FR-001〜FR-005、research.md の R3）
- [x] T007 [P] `FetchedItem`・`FetchOutcome`・`UrlCheck` の型と、日付の変換（日本時間の暦の日付 ⇔ UTC の日時）を src/features/activity/domain/fetched-item.ts と src/features/activity/domain/date.ts に作る（research.md の R4・R9）
- [x] T008 外部の activity の Repository のインタフェースを src/features/activity/domain/activity-repository.ts に作る

---

## Phase 3: User Story 1 - 外部のサービスに書いたものを、一覧に自動で取り込む (Priority: P1)

**Goal**: 一覧を取る取得元から取り込み、同じ項目を 2 行にしない

**Independent Test**: 固定した応答の取得元で 2 回取り込み、題・URL・公開日を持つ行が 1 件ずつであること

- [x] T009 [P] [US1] 外への要求の上限（10 秒・2,000,000 文字）と User-Agent を src/features/activity/server/sources/http.ts に作る（research.md の R6）
- [x] T010 [P] [US1] RSS の `<item>` を読む関数を src/features/activity/server/sources/rss.ts に作る
- [x] T011 [US1] Zenn・Qiita・dev.to・Medium・GitHub・Speaker Deck・connpass の取得の関数を src/features/activity/server/sources/ に作り、`FetchedItem` に詰め替える（research.md の R4）
- [x] T012 [P] [US1] 取得元ごとの詰め替えを tests/unit/activity-sources.test.ts で確かめる（固定した応答。外のサービスを叩かない）
- [x] T013 [US1] 外部の activity の D1 の実装を src/features/activity/server/d1-activity-repository.ts に作る。値が変わった行だけを書く（research.md の R5）
- [x] T014 [P] [US1] 同じ項目を ID と URL で 1 行にすること、値の変わらない行を書かないこと、`created_at` が取り直しで変わらないこと、取得の処理が life event を書き換えないことを tests/workers/activity-repository.test.ts で確かめる（FR-008・FR-013・FR-032・SC-001）
- [x] T015 [US1] 一覧を取る枠のユースケースを src/features/activity/application/refresh-source.ts に作る（contracts/fetch.md）
- [x] T016 [US1] 枠を選んで呼ぶユースケースを src/features/activity/application/run-scheduled-fetch.ts に、Worker の入口を src/features/activity/server/scheduled.ts と worker/index.ts の `scheduled()` に、`triggers.crons` を wrangler.jsonc に作る（research.md の R6）

---

## Phase 4: User Story 2 - 取得に失敗しても、一覧を出し続ける (Priority: P1)

**Goal**: 失敗した取得元の activity を残し、取得の結果を記録する

**Independent Test**: 失敗する取得元で取得を走らせ、前回の activity が残り、取得の結果に失敗と理由が残る

- [x] T017 [US2] 取得の結果の書き方（`last_succeeded_at` を失敗の間も残す）を d1-activity-repository.ts に足し、tests/workers/activity-repository.test.ts で確かめる（FR-016）
- [x] T018 [P] [US2] 失敗したときに activity を書き換えず失敗を記録すること、成功したときに件数を理由に書くことを tests/unit/activity-refresh.test.ts で確かめる（FR-014・FR-015・SC-002）

---

## Phase 5: User Story 3 - 取得元で消したものを、一覧から消す (Priority: P1)

**Goal**: URL が 404・410 を返したと確かめた activity だけを、1 回 5 件まで消す

**Independent Test**: 候補の URL が 404 を返すようにして取得を走らせ、その行が消え、判定できない行が残る

- [x] T019 [US3] 候補の選び方と消す件数の上限を src/features/activity/domain/gone.ts に作る（research.md の R7）
- [x] T020 [P] [US3] 件数が決まっている取得元で古いものを候補にしないこと、404・410 で消し、ほかは残すこと、上限を tests/unit/activity-gone.test.ts と tests/unit/activity-refresh.test.ts で確かめる（FR-017〜FR-020・SC-003・SC-004）
- [x] T021 [US3] 候補の URL を確かめる関数を src/features/activity/server/sources/http.ts に足し、refresh-source.ts で使う

---

## Phase 6: User Story 4 - URL を指名して、または手で入力して取り込む (Priority: P2)

**Goal**: オーナーが URL を指名して、または手で入力して activity を登録・書き換え・削除する

**Independent Test**: URL を指名する取得元に URL と日付を登録し、題が取れて保存され、取り直しても日付が変わらない

- [x] T022 [P] [US4] X・Spotify・YouTube の oEmbed と CodeSandbox の og:title を取る関数を src/features/activity/server/sources/oembed.ts と src/features/activity/server/sources/codesandbox.ts に作り、URL がその取得元のものかと ID の取り出しを src/features/activity/domain/source.ts に足す（research.md の R9）
- [x] T023 [US4] 登録・書き換え・削除の決まりとフォームの値の読み方を src/features/activity/domain/activity.ts に作る
- [x] T024 [US4] 登録・書き換え・削除のユースケースを src/features/activity/application/ に作る（FR-009〜FR-012・FR-021・FR-022・FR-031・FR-033）
- [x] T025 [P] [US4] 日付の無い登録を拒むこと、題を取れない URL を保存しないこと、一覧を取る activity を書き換え・削除できないこと、登録していないサイトの activity を保存することを tests/unit/activity-usecases.test.ts で確かめる
- [x] T026 [US4] URL を指名した activity の取り直しを src/features/activity/application/refresh-registered.ts に作り、日付を書き換えないことを tests/unit/activity-refresh.test.ts と tests/workers/activity-repository.test.ts で確かめる（FR-012・SC-005）
- [x] T027 [US4] 管理画面（`/dash/activities`、`new`、`{uid}`、`{uid}/delete`、`{uid}/missing`）と Server Action を src/app/dash/activities/ と src/features/activity/server/actions.ts・queries.ts・components/activity-form.tsx に作る。`/dash/activities` に取得の結果の表を出す（contracts/dash.md、research.md の R13）
- [x] T028 [US4] `/dash/activities/{uid}` の無い uid を src/proxy.ts で rewrite し、tests/unit/proxy.test.ts に足す。src/app/dash/page.tsx の入口に足す

---

## Phase 7: User Story 5 - life event を書き、一覧に並べ、個別のページで見せる (Priority: P2)

**Goal**: オーナーが life event を作り、訪問者が `/life-events/{slug}` で読む

**Independent Test**: life event を 1 件作り、訪問者としてその識別子の URL で開け、削除すると `media` を含めて残らない

- [x] T029 [US5] life event の型・決まり・フォームの値の読み方と Repository のインタフェースを src/features/activity/domain/life-event.ts と src/features/activity/domain/life-event-repository.ts に作る（FR-023〜FR-026・FR-035、research.md の R10）
- [x] T030 [US5] life event の D1 の実装を src/features/activity/server/d1-life-event-repository.ts に作る。削除で `media` を消す（FR-027）
- [x] T031 [P] [US5] 保存・識別子の重複の拒否・削除で `media` が残らないことを tests/workers/life-event-repository.test.ts で確かめる（SC-006）
- [x] T032 [US5] life event のユースケースを src/features/activity/application/ に作り、tests/unit/life-event.test.ts で決まりを確かめる
- [x] T033 [US5] 管理画面（`/dash/life-events` 一式）と訪問者のページ（`/life-events/[slug]`）を作る。src/proxy.ts に足し、tests/unit/proxy.test.ts に足す（contracts/visitor-life-event.md）
- [ ] T034 [US5] life event の画像の追加と代表画像の選択（FR-028・FR-029・FR-030、User Story 5 の 4・5）。**止める依存: U10**（#209 の画像の仕組み）

---

## Phase 8: Polish

- [x] T035 [P] `/life-events/{slug}` の 200・404、`/dash/activities`・`/dash/life-events` の 403 と `no-store`、JWT のない書き込みが何も書かないことを tests/integration/activities.test.ts で確かめる（FR-031・FR-034・SC-007）
- [x] T036 [P] tests/integration/dash-url-without-id.test.ts の seed に life event と手で入力した activity を足す
- [x] T037 [P] オーナーとして life event を作り・書き換え・消すこと、手で入力する activity を登録し・消すこと、キーボードだけの操作を tests/e2e/activity.spec.ts で確かめる（constitution V）
- [x] T038 `npm run lint`・`npm run format:check`・`npx tsc --noEmit`・4 段階の検査を通し、`bash .claude/skills/auditing-docs-convention/scripts/check.sh` の出力が無いことを確かめる
- [x] T039 quickstart.md の「手元で取得を走らせる」を行う
- [ ] T040 PR の CI が 10 分以内に収まることを GitHub Actions のステップの所要時間で確かめる（ADR-0019）
- [ ] T041 quickstart.md の「手で確かめる」をブランチの Preview で行う

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2・US3（US1 の refresh-source.ts を使う）
- US4・US5 は Phase 2 の後に並べられる。どちらも src/proxy.ts と src/app/dash/page.tsx を直すため、続けて行う
- Polish は全 User Story の後

## Parallel Example: User Story 1

```text
T009 http.ts、T010 rss.ts
↓
T011 sources/ → T012 tests/unit/activity-sources.test.ts
T013 d1-activity-repository.ts → T014 tests/workers/activity-repository.test.ts
↓
T015 → T016
```

## Implementation Strategy

### MVP First

1. Phase 1・2
2. US1〜US3 で、一覧を取る取得元の取り込み・失敗・消えたものの扱いをそろえる。US1 だけでは、取得元で非公開にした記事が一覧に残り続けるため、US3 を終えるまで main にマージしない

### Incremental Delivery

US1〜US3 → US4 → US5 → Polish。各段階を Preview で確かめてからマージする

## Notes

- 機能どうしは import しない（ADR-0026）
- 書き込みの Server Action は、先頭でオーナーを確かめる。結合の検査で各 Server Action を確かめる
- 検査は外部のサービスを叩かない。取得元の関数に、固定した応答を返す `fetch` を渡す
