---

description: "Task list for note を書いて公開し、読む"
---

# Tasks: note を書いて公開し、読む

**Input**: Design documents from `specs/005-note-write-and-read/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: constitution の III. Verified Scope が、満たすべきことの1つ1つに検査を対応させることを求めるため、テストの作業を含める。段階の割り当ては research.md の R6。

**Organization**: 作業を User Story ごとにまとめる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行して進められる（別のファイルで、終わっていない作業に依存しない）
- **[Story]**: どの User Story の作業か（US1, US2, US3）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依存・マイグレーション・設定を揃える

- [ ] T001 `jose` と `server-only` を dependencies に足す in package.json
- [ ] T002 [P] data-model.md の表 `note` と `note_publication`、公開後の slug の変更を止めるトリガを、STRICT の表で書く in migrations/0001_create_note.sql
- [ ] T003 [P] workerd のテストが `migrations/` を読むように、`readD1Migrations` の読み先を変え、D1 の `migrations_dir` を `../migrations` にする。配管の検査だった tests/workers/d1-plumbing.test.ts と tests/fixtures/migrations/0001_probe.sql を消す in vitest.workers.config.ts と tests/wrangler.test.jsonc
- [ ] T004 [P] `rewrites()` の `fallback` に `/dash/:path*` から同じ経路への rewrite を足し、`/dash` 配下をデプロイ時のキャッシュ判定から外す。理由を research.md の R7 への参照とともにコメントに書く in next.config.js
- [ ] T005 [P] JWT の検証の設定値 `ACCESS_ISSUER`・`ACCESS_AUD`・`ACCESS_OWNER_EMAIL` の型を、`wrangler types` が secret を拾う形（`.dev.vars` の雛形）で用意する in .dev.vars.example と .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: どの User Story も使う、note の規則・保存・作り手の確かめ方

- [ ] T006 [P] slug・題・本文の規則（文字数はコードポイントで数える）、状態、画面に渡す形（`PublishedNoteDto`、`NoteSummaryDto`、`EditableNoteDto`）を定める in src/features/note/domain/note.ts
- [ ] T007 [P] `NoteRepository` のインタフェース（作る、保存する、公開する、削除する、公開済みを slug で取り出す、編集用に id で取り出す、作り手向けに一覧する）を定める in src/features/note/domain/note-repository.ts
- [ ] T008 [P] slug・題・本文の規則の単体テスト。境界（200文字と201文字、絵文字、大文字、空）を含める in tests/unit/note-domain.test.ts
- [ ] T009 `NoteRepository` の D1 の実装。先頭で `import 'server-only'`。訪問者向けの取り出しは `note_publication` の列だけを列挙して SELECT する。存在しない id への保存・公開・削除を「存在しない」として返す in src/features/note/server/d1-note-repository.ts
- [ ] T010 D1 の実装のテスト。下書きが公開済みの取り出しに出ない、公開し直しても初めて公開した日時が変わらない、公開後の slug の変更が拒まれる、削除で公開の行も消える、削除した slug を使い回せる、書き換え待ちの判定、データベースの制約 in tests/workers/d1-note-repository.test.ts
- [ ] T011 [P] `Cf-Access-Jwt-Assertion` の JWT を `jose` で検証し、作り手（`Author`）か拒否を返す関数。公開鍵の取得先、`iss`、`aud`、オーナーのメールアドレスを引数で受け取る。設定値が欠けたら拒否する in src/features/note/server/author.ts
- [ ] T012 [P] JWT の検証の単体テスト。テスト用の鍵で署名し、正しい JWT は通り、ヘッダなし・署名違い・`aud` 違い・期限切れ・メールアドレス違い・設定値の欠けは拒否されることを確かめる in tests/unit/note-author.test.ts
- [ ] T013 E2E で作り手として操作するための仕組み。テスト用の鍵の組を作り、公開鍵を配る小さなサーバを Playwright の webServer に足し、`wrangler dev` に `.dev.vars` で `ACCESS_ISSUER` をそのサーバへ向ける。`wrangler dev` の中の Worker からそのサーバへ公開鍵を取りに行けるかを確かめ、結果を research.md の R6 に書く in tests/e2e/support/access.ts と playwright.config.ts
- [ ] T014 E2E の前にローカルの D1 へマイグレーションを当てる手順を足す in playwright.config.ts と .github/workflows/ci.yml

**Checkpoint**: 規則・保存・作り手の確かめ方が揃い、User Story の作業を始められる

---

## Phase 3: User Story 1 - note を書いて公開し、訪問者が読む (Priority: P1) 🎯 MVP

**Goal**: 作り手が `/dash` で note を作り、公開し、訪問者が `/notes/{slug}` で読める

**Independent Test**: `/dash` で note を1件作って公開し、作り手としてログインしていないブラウザで `/notes/{slug}` を開くと、題・公開日・本文が読める

### Tests for User Story 1

- [ ] T015 [P] [US1] ユースケース「作る」「公開する」「公開済みを読む」「一覧する」の単体テスト。偽の `NoteRepository` を渡す。題が空なら公開しない、存在しない note は公開しない in tests/unit/note-usecases.test.ts
- [ ] T016 [P] [US1] 訪問者の経路の結合テスト。公開済みは 200 で題・公開日・本文を返す。下書きと存在しない slug は同じ 404 を返し、下書きの題と本文が応答（本文、`<title>`、メタデータ）に現れない in tests/integration/notes.test.ts
- [ ] T017 [P] [US1] 作り手の経路の結合テスト。JWT のない `/dash`・`/dash/notes/new`・`/dash/notes/{id}` が 403。JWT のない操作の要求と、Origin が異なる操作の要求が何も書き込まない。ビルド出力の `dist/server/vinext-prerender-paths.json` に `/dash` 配下が入らない in tests/integration/dash.test.ts
- [ ] T018 [P] [US1] JavaScript を切った E2E。作り手として note を作る → 訪問者として `/notes/{slug}` が 404 → 公開する → 訪問者として題・公開日・本文を読む。本文の改行が保たれ、HTML の文字列が文字のまま出る in tests/e2e/note-publish.spec.ts

### Implementation for User Story 1

- [ ] T019 [P] [US1] ユースケース「作る」「公開する」（入力を保存してから公開する）「公開済みを読む」「一覧する」。`NoteRepository` を引数で受け取る in src/features/note/application/create-note.ts、publish-note.ts、get-published-note.ts、list-notes.ts
- [ ] T020 [US1] 組み立て用の関数。`getPublishedNote(slug)`、`listNotesForAuthor()`、`getNoteForEdit(id)`。作り手向けの2つは、先に作り手であることを確かめる in src/features/note/server/queries.ts
- [ ] T021 [US1] Server Action `createNoteAction`・`publishNoteAction`。先に作り手であることを確かめ、確かめられなければ何も書き込まずに失敗を返す。入力の誤り・存在しない note・失敗を、入力した値とともに返す in src/features/note/server/actions.ts
- [ ] T022 [P] [US1] 作る・編集のフォーム（`useActionState`、ラベル付きの入力、JavaScript なしで送れる）、公開済みの note の表示（本文を文字列で出し、改行を保つ）、作り手の一覧 in src/features/note/components/note-form.tsx、published-note.tsx、note-list.tsx
- [ ] T023 [US1] 訪問者の画面。`force-dynamic`、存在しなければ `notFound()`、メタデータは公開済みの値だけから作る in src/app/notes/[slug]/page.tsx
- [ ] T024 [US1] 作り手の画面。`force-dynamic`、作り手であることを確かめられなければ `forbidden()` in src/app/dash/page.tsx、src/app/dash/notes/new/page.tsx、src/app/dash/notes/[id]/page.tsx

**Checkpoint**: User Story 1 が単独で動き、T015〜T018 が通る

---

## Phase 4: User Story 2 - 作り手が note を書き換える (Priority: P2)

**Goal**: 作り手が note を保存し、公開済みの note は公開し直すまで訪問者に見えない

**Independent Test**: 公開済みの note の題を書き換えて公開し直し、`/notes/{slug}` に書き換えた題が出る

### Tests for User Story 2

- [ ] T025 [P] [US2] ユースケース「保存する」の単体テスト。公開済みの note の slug は変えられない、存在しない note は保存しない in tests/unit/note-usecases.test.ts
- [ ] T026 [P] [US2] JavaScript を切った E2E。公開済みの note を保存 → 訪問者には書き換える前の題 → 一覧に書き換え待ちが出る → 公開し直す → 訪問者に書き換えた題、公開日は変わらない in tests/e2e/note-edit.spec.ts

### Implementation for User Story 2

- [ ] T027 [US2] ユースケース「保存する」 in src/features/note/application/save-note.ts
- [ ] T028 [US2] Server Action `saveNoteAction` と、編集のフォームの「保存する」、公開済みの note での「公開し直す」の呼び名と slug を変えられない表示 in src/features/note/server/actions.ts と src/features/note/components/note-form.tsx

**Checkpoint**: User Story 1 と 2 が動く

---

## Phase 5: User Story 3 - 作り手が note を完全に削除する (Priority: P3)

**Goal**: 作り手が確認を経て note を削除し、訪問者に見えなくなる

**Independent Test**: 公開済みの note を削除し、`/notes/{slug}` が 404 になり、`/dash` の一覧からも消える

### Tests for User Story 3

- [ ] T029 [P] [US3] ユースケース「削除する」の単体テスト in tests/unit/note-usecases.test.ts
- [ ] T030 [P] [US3] JavaScript を切った E2E。削除の確認の画面を経て削除 → 訪問者に 404 → 一覧から消える → 同じ slug で作れる。別のページで削除した note を保存すると、存在しないことが出る in tests/e2e/note-delete.spec.ts

### Implementation for User Story 3

- [ ] T031 [US3] ユースケース「削除する」 in src/features/note/application/delete-note.ts
- [ ] T032 [US3] Server Action `deleteNoteAction` と削除の確認の画面（`force-dynamic`、作り手でなければ `forbidden()`） in src/features/note/server/actions.ts と src/app/dash/notes/[id]/delete/page.tsx

**Checkpoint**: すべての User Story が動く

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T033 [P] 配信後の検査に、認証なしの `/dash` が Access のログイン（`*.cloudflareaccess.com`）へ移されることを足す。プレビュー URL を検査するときは、`.env.local` の service token をヘッダに付ける in scripts/lib/verify-deploy.mjs、scripts/verify-deploy.mjs、tests/unit/verify-deploy.test.ts
- [ ] T034 [P] マイグレーションの作り方と適用の命令、JWT の検証の secret、service token の環境変数を書く in README.md
- [ ] T035 [P] デザインパターンの「手本のファイル」を、この機能で最初に書いたファイルで埋める（Repository、DTO、組み立て用の関数、Dependency Injection、ユースケースを単位にする） in docs/SOFTWARE_DESIGN.md
- [ ] T036 `npm test`、`npm run test:workers`、`npm run build`、`npx tsc --noEmit`、`npx tsc --noEmit -p tests/tsconfig.json`、`npm run lint`、`npm run format:check`、`npm run test:integration:only`、`npm run test:e2e:only` をすべて通す
- [ ] T037 Cloudflare の設定: Access のアプリケーション2つ（本番の `/dash`、プレビュー全体）と service token を作り、Worker の secret を入れ、本番の D1 に `npx wrangler d1 migrations apply synsk-me --remote` を当てる。Zero Trust の組織が作られていることが前提
- [ ] T038 quickstart.md の「プレビュー URL で確かめる」を実行し、結果を記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup の後。すべての User Story を止める
- **User Stories (Phase 3〜5)**: Foundational の後。US2 と US3 は US1 の画面（T022、T024）の上に操作を足す
- **Polish (Phase 6)**: すべての User Story の後。T037 は Zero Trust の組織が作られるまで始められない。T038 は T037 の後

### Within Each User Story

- テストを先に書き、落ちることを確かめてから実装する
- ユースケース → 組み立て用の関数と Server Action → 部品 → 画面

### Parallel Opportunities

- T002〜T005 は並行できる
- T006〜T008、T011〜T012 は並行できる
- 各 User Story のテスト（[P]）は並行できる

---

## Parallel Example: User Story 1

```bash
Task: "ユースケースの単体テスト in tests/unit/note-usecases.test.ts"
Task: "訪問者の経路の結合テスト in tests/integration/notes.test.ts"
Task: "作り手の経路の結合テスト in tests/integration/dash.test.ts"
Task: "JavaScript を切った E2E in tests/e2e/note-publish.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 と Phase 2 を終える
2. Phase 3（User Story 1）を終える
3. T015〜T018 が通ることを確かめる

### Incremental Delivery

1. User Story 1 → 2 → 3 の順に足し、各段で、それまでのテストが通り続けることを確かめる
2. Phase 6 で配信の検査と文書を揃え、プレビュー URL で quickstart.md を通す

---

## Notes

- 作業ごと、または作業のまとまりごとにコミットする
- `/dash` 配下の画面と操作を足すときは、必ず作り手であることを先に確かめる（ADR-0036）
