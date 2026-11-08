---

description: "note の実装タスク"
---

# Tasks: note

**Input**: `specs/003-note/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（書き込みの経路に、オーナー以外が通れないことの検査を書く）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US7）

## Contents

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1（P1）
- Phase 4: User Story 2（P1）
- Phase 5: User Story 3（P2）
- Phase 6: User Story 4（P2）
- Phase 7: User Story 5（P2）
- Phase 8: User Story 6（P3）
- Phase 9: User Story 7（P3）
- Phase 10: Polish
- Dependencies & Execution Order

---

## Phase 1: Setup

- [X] T001 `react-markdown` 10.1.0 を `dependencies` に足す（research.md の R6）
- [X] T002 `migrations/0015_add_uid_to_note.sql` を作る。`note` を作り直して `uid` を足し、行・`sqlite_sequence`・トリガを移す（research.md の R1）
- [X] T003 [P] T002 の列・DEFAULT・書き換えの拒否と、0005 のトリガが残ることを tests/workers/migrations.test.ts に足す
- [X] T004 [P] tests/wrangler.test.jsonc に R2 の binding `NOTE_IMAGES` を足す

---

## Phase 2: Foundational

- [X] T005 note の型・入力の読み方・版の番号の決まりを src/features/note/domain/note.ts に作る（data-model.md の domain の型）
- [X] T006 [P] T005 の入力の読み方（識別子の形・題と本文の長さ・説明文の空）を tests/unit/note-domain.test.ts で確かめる
- [X] T007 `NoteRepository` を src/features/note/domain/note-repository.ts に、D1 の実装を src/features/note/server/d1-note-repository.ts に作る（作る・保存・公開・下書きに戻す・削除・戻す・版の一覧と中身・過去の版に戻す・訪問者向けの取り出し・uid と識別子の有無）
- [X] T008 `src/features/note/server/queries.ts` に組み立て用の関数を作り、src/proxy.ts に `/notes/:slug` の 404 と `/dash/notes/{uid}`・`/dash/notes/{uid}/revisions/{番号}` の 404 を足す（research.md の R12）
- [X] T009 [P] T008 の rewrite を tests/unit/proxy.test.ts に足す
- [X] T010 [P] note の作り物の行を入れる道具を tests/support/note-rows.ts に作る
- [X] T011 src/app/dash/page.tsx の入口に note を足す

---

## Phase 3: User Story 1 - note を書いて公開し、訪問者に読ませる（P1）

- [X] T012 [P] [US1] 作る・保存・公開・公開し直し・識別子の決まりを tests/workers/note-repository.test.ts で確かめる（FR-001〜FR-003・FR-006・FR-011〜FR-013・SC-004）
- [X] T013 [P] [US1] ユースケース（作る・保存・公開）の分岐とオーナーの確認を tests/unit/note-usecases.test.ts で確かめる
- [X] T014 [US1] ユースケース create-note・save-note・publish-note を src/features/note/application/ に作る
- [X] T015 [US1] Server Action（createNote・saveNote・publishNote）を src/features/note/server/actions.ts に作る
- [X] T016 [US1] 管理画面 `/dash/notes`・`/dash/notes/new`・`/dash/notes/{uid}`・`/dash/notes/{uid}/preview` と、フォームの部品を作る
- [X] T017 [US1] 本文の描画の部品（Markdown、生の HTML を描かない）を src/features/note/components/note-body.tsx に作る（research.md の R6）
- [X] T018 [US1] 訪問者のページ `/notes/{slug}` と `/notes/{slug}/missing` を作る。`generateMetadata` は DTO の値だけを使う
- [X] T019 [US1] `/notes/{slug}` の 200・404、下書きと公開後に保存した版が応答に無いこと、`/dash/notes` の 403 と `no-store`、JWT のない書き込みが何も書かないことを tests/integration/notes.test.ts で確かめる（SC-001・FR-033）

---

## Phase 4: User Story 2 - 公開をやめる・削除する・削除を戻す（P1）

- [X] T020 [P] [US2] 下書きに戻す・削除・戻す・削除した識別子の再利用の拒否を tests/workers/note-repository.test.ts に足す（FR-014・FR-016・SC-007）
- [X] T021 [US2] ユースケース unpublish-note・delete-note・undelete-note と Server Action、`/dash/notes/{uid}/delete` を作る
- [X] T022 [US2] 下書きに戻した note と削除した note の `/notes/{slug}` が 404 で中身が無いことを tests/integration/notes.test.ts に足す

---

## Phase 5: User Story 3 - 過去の版を残し、戻す（P2）

- [X] T023 [P] [US3] 版の一覧と中身、過去の版に戻すことを tests/workers/note-repository.test.ts に足す（FR-008・FR-009・SC-003）
- [X] T024 [US3] ユースケース restore-revision と Server Action、`/dash/notes/{uid}/revisions`・`/dash/notes/{uid}/revisions/{番号}` を作る

---

## Phase 6: User Story 4 - 書いている内容を失わない（P2）

- [X] T025 [US4] 保存の衝突を止め、内容を残して知らせる形をフォームに作る（FR-020・FR-021、research.md の R4）
- [X] T026 [US4] 書きかけの内容を `localStorage` に持つ部品を src/features/note/components/ に作る（FR-018・FR-019、research.md の R11）
- [X] T027 [US4] 2 つの画面の保存の衝突、書きかけの保持、続けて 2 回の保存、スマートフォンの幅で作って公開、キーボードだけの操作を tests/e2e/note.spec.ts で確かめる（SC-002・SC-006・FR-022）

---

## Phase 7: User Story 5 - 本文に画像を置き、代表画像を選ぶ（P2）

- [X] T028 [US5] R2 の読み書きを src/shared/server/media-storage.ts に作る（constitution VIII）
- [X] T029 [P] [US5] 画像の形式の見分けと上限を src/features/note/domain/note-image.ts に作り、tests/unit/note-image.test.ts で確かめる（research.md の R7）
- [X] T030 [US5] 画像の追加（R2 に書いてから `media`）、代表画像の選択、配る条件を Repository とユースケースと Server Action に作り、`next.config.js` の Server Action の本文の上限を 6 MB にする
- [X] T031 [US5] `/notes/{slug}/images/{file}` と `/dash/notes/{uid}/images/{file}` の route handler、`/notes/{slug}/card-image` を作り、`og:image` を出す（research.md の R8）
- [X] T032 [P] [US5] 配る条件（下書き・公開後の版だけ・代表画像）と、ほかの note の画像を代表画像に選べないことを tests/workers/note-media.test.ts で確かめる（FR-025・FR-026）
- [X] T033 [US5] 画像の 200・404 と `og:image` を tests/integration/note-images.test.ts で確かめる

---

## Phase 8: User Story 6 - 参照先の URL をカードで見せる（P3）

- [X] T034 [P] [US6] カードにする URL の取り出しと上限を src/features/note/domain/link-card.ts に作り、tests/unit/link-card.test.ts で確かめる（research.md の R9）
- [X] T035 [US6] 参照先の HTML から題と画像を取る src/features/note/server/link-preview-fetcher.ts を作り、tests/unit/link-preview-fetcher.test.ts で確かめる（時間・大きさの上限、取れないとき）
- [X] T036 [US6] 保存のときの取得と「参照先の情報を取り直す」、`link_preview` の保存、カードの描画を作る
- [X] T037 [US6] `link_preview` が URL ごとに 1 つで取り直しが両方の note に効くことを workerd で、表示で取りに行かないことを結合で確かめる（FR-028・FR-029・SC-005）

---

## Phase 9: User Story 7 - 転載先を記録する（P3）

- [X] T038 [US7] 転載先を足す・消すを Repository とユースケースと Server Action と編集の画面に作る
- [X] T039 [P] [US7] 2 つ記録でき、同じ URL を別の note に記録できないことを tests/workers/note-repository.test.ts に足す（FR-031・FR-032）

---

## Phase 10: Polish

- [X] T040 完全に消す操作を Repository に作り、一部だけ残らないことを tests/workers/note-repository.test.ts で確かめる（FR-017、research.md の R13）
- [X] T041 `npm run lint`・`npm run format:check`・`npx tsc --noEmit`・`npx tsc --noEmit -p tests/tsconfig.json`・`npm test`・`npm run test:workers`・`npm run test:integration`・`npm run test:e2e` を通す
- [X] T042 `bash .claude/skills/auditing-docs-convention/scripts/check.sh` を実行し、出力が無いことを確かめる
- [X] T043 quickstart.md の「手で確かめる」を手元で行う
- [ ] T044 quickstart.md の手順をブランチの Preview で行う

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 の順。Phase 4〜9 は Phase 3 の後に、どの順でも進められる
- T030 は T028 の後。T036 は T034・T035 の後
