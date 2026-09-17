---

description: "Task list for note を書いて公開し、読む"
---

# Tasks: note を書いて公開し、読む

**Input**: Design documents from `specs/005-note-write-and-read/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: constitution の III. Verified Scope が、満たすべきことの1つ1つに検査を対応させることを求めるため、テストの作業を含める。段階の割り当ては research.md の R6。同じことを2つの段階で確かめない。

**Organization**: 作業を User Story ごとにまとめる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行して進められる（別のファイルで、終わっていない作業に依存しない）
- **[Story]**: どの User Story の作業か（US1, US2, US3）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 前提を確かめ、依存・マイグレーション・設定を揃える

- [x] T001 `wrangler dev` の中の Worker から、`ACCESS_ISSUER` で向けた手元の公開鍵のサーバへ要求が届くかを scratchpad で確かめ、結果を research.md の R6 に書く
- [X] T002 `jose` と `server-only` を dependencies に足す in package.json
- [X] T003 [P] data-model.md の表 `note`（id は `INTEGER PRIMARY KEY AUTOINCREMENT`）と `note_publication`、公開後の slug の変更を止めるトリガを、STRICT の表で書く in migrations/0001_create_note.sql
- [X] T004 [P] workerd のテストが `migrations/` を読むように、`readD1Migrations` の読み先を変え、D1 の `migrations_dir` を `../migrations` にする。D1 の配管を確かめる tests/workers/d1-plumbing.test.ts と tests/fixtures/migrations/0001_probe.sql を消す in vitest.workers.config.ts と tests/wrangler.test.jsonc
- [X] T005 [P] `rewrites()` の `fallback` に `/dash/:path*` から同じ経路への rewrite を足し、`/dash` 配下をデプロイ時のキャッシュ判定から外す。理由をコメントに書く in next.config.js
- [X] T006 [P] JWT の検証の設定値 `ACCESS_ISSUER`・`ACCESS_AUD`・`ACCESS_OWNER_EMAIL` の雛形を置く in .dev.vars.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: どの User Story も使う、note の規則・保存・作り手の確かめ方・テストの土台

- [X] T007 [P] slug・題・本文の規則（文字数はコードポイントで数える）、状態、公開日を日本時間の `YYYY-MM-DD` に直す関数、画面に渡す形（`PublishedNoteDto`、`NoteSummaryDto`、`EditableNoteDto`）を定める in src/features/note/domain/note.ts
- [X] T008 [P] `NoteRepository` のインタフェースを定める。作る、保存する、公開する（保存と公開を1つの書き込みで）、削除する、公開済みを slug で取り出す、編集用に id で取り出す、作り手向けに一覧する。結果に「slug の重複」「存在しない」「公開後の slug の変更」を区別して返す in src/features/note/domain/note-repository.ts
- [X] T009 [P] 規則の単体テスト。境界（題200文字と201文字、本文100,000文字と100,001文字、絵文字、大文字、空の slug、100文字と101文字の slug）と、公開日の日付（`2026-09-16T15:30:00.000Z` が `2026-09-17`）を含める in tests/unit/note-domain.test.ts
- [X] T010 `NoteRepository` の D1 の実装。先頭で `import 'server-only'`。訪問者向けの取り出しは `note_publication` の列だけを列挙して SELECT する。公開は `db.batch()` で保存と写しを原子的に行う in src/features/note/server/d1-note-repository.ts
- [X] T011 D1 の実装のテスト。下書きが公開済みの取り出しに出ない、公開し直しても初めて公開した日時が変わらない、公開の2文目が失敗すると保存も残らない、公開後の slug の変更が拒まれる、削除で公開の行も消える、削除した slug を使い回せる、削除した id を使い回さない、公開し直していない書き換えの判定、データベースの制約 in tests/workers/d1-note-repository.test.ts
- [X] T012 [P] `Cf-Access-Jwt-Assertion` の JWT を `jose` で検証し、作り手（`Author`）か拒否を返す関数。先頭で `import 'server-only'`。JWT の型を関数の外に出さず `Author` に変換する。公開鍵の取得先、`iss`、`aud`、オーナーのメールアドレスを引数で受け取る。設定値が欠けたら拒否する。公開鍵が取れなければ拒否する in src/features/note/server/author.ts
- [X] T013 [P] JWT の検証の単体テスト。テスト用の鍵で署名し、正しい JWT は通り、ヘッダなし・署名違い・`aud` 違い・期限切れ・メールアドレス違い・設定値の欠け・公開鍵が取れないは拒否されることを確かめる in tests/unit/note-author.test.ts
- [X] T014 [P] テスト用の鍵と作り手の JWT。テスト用の鍵の組を作り、公開鍵を `/cdn-cgi/access/certs` で配るサーバを起動する関数と、作り手の JWT を作る関数を置く。結合テストと E2E の両方が使う in tests/support/access.ts
- [X] T015 結合テストの土台。ビルド出力を起動する前に `migrations/` を当て、公開済み1件・公開し直していない書き換えのある公開済み1件・下書き1件を SQL で入れる。`ACCESS_*` を T014 の公開鍵のサーバへ向けて `createTestHarness()` に渡す。渡せなければ、渡す方法を research.md の R6 に書く。行の数と中身を読む関数を置く in tests/integration/support/d1.ts
- [X] T016 E2E の土台。Playwright の webServer に T014 の公開鍵のサーバを足し、作り手の JWT をブラウザの要求のヘッダに付ける関数を置く。`wrangler dev` を起動する前に、ローカルの D1 へマイグレーションを当て、`dist/server/.dev.vars` に `ACCESS_*` を書く。CI でも同じ手順を踏む in tests/e2e/support/author.ts、playwright.config.ts、.github/workflows/ci.yml

**Checkpoint**: 規則・保存・作り手の確かめ方・テストの土台が揃い、User Story の作業を始められる

---

## Phase 3: User Story 1 - note を書いて公開し、訪問者が読む (Priority: P1) 🎯 MVP

**Goal**: 作り手が `/dash` で note を作り、公開し、訪問者が `/notes/{slug}` で読める

**Independent Test**: `/dash` で note を1件作って公開し、作り手としてログインしていないブラウザで `/notes/{slug}` を開くと、題・公開日・本文が読める

### Tests for User Story 1

- [X] T046 [US1] JWT の検証が、`ACCESS_AUD` のカンマ区切りの AUD タグのどれかに一致する JWT を通すようにし、単体テストに2つの AUD のそれぞれで通ることを足す（research.md の R2） in src/features/note/server/author.ts と tests/unit/note-author.test.ts

- [X] T017 [P] [US1] ユースケース「作る」「公開する」「公開済みを読む」「一覧する」の単体テスト。偽の `NoteRepository` を渡す。入力の誤り、slug の重複、公開後の slug の変更、題が空の公開、存在しない note、保存の失敗のそれぞれで、書き込まずに種類の分かる結果を返す in tests/unit/note-usecases.test.ts
- [X] T018 [P] [US1] 訪問者の経路の結合テスト。公開済みは 200 で題・公開日・本文を返し、本文の改行が保たれ、HTML の文字列が文字のまま出て、公開し直していない書き換えは出ない。下書きと存在しない slug は同じ 404 を返し、下書きの題と本文が応答（本文、`<title>`、メタデータ）に現れない。D1 が読めないときは 500 で、note の題と本文を含まない in tests/integration/notes.test.ts
- [X] T019 [P] [US1] 作り手の経路の結合テスト。JWT のない `/dash`・`/dash/notes/new`・`/dash/notes/{id}` が 403。JWT のない「作る」「公開する」の操作と、Origin が異なる操作の前後で、D1 の行が変わらない。作り手の JWT 付きで、存在しない id の `/dash/notes/{id}` が 404、D1 が読めないときの `/dash` と `/dash/notes/{id}` が 500 で note の題と本文を含まない、D1 が書き込めないときの「作る」「公開する」が失敗を返し入力した値を含む。ビルド出力の `dist/server/vinext-prerender-paths.json` に `/dash` 配下が入らない in tests/integration/dash.test.ts
- [X] T020 [P] [US1] JavaScript を切った E2E。作り手として note を作る → 一覧に下書きとして並ぶ → 訪問者として note がないことが伝わる → 公開する → 訪問者として題・公開日・本文を読む。空の slug、使えない slug、重複した slug、長すぎる題と本文、空の題での公開のそれぞれで、誤りの文言が出て題と本文が残る。note が0件の一覧の文言 in tests/e2e/note-publish.spec.ts
- [X] T021 [P] [US1] 「作る」「公開する」を、キーボードだけで行う E2E と、幅 360px の画面で行う E2E in tests/e2e/note-input-methods.spec.ts

### Implementation for User Story 1

- [X] T022 [P] [US1] ユースケース「作る」「公開する」「公開済みを読む」「一覧する」。`NoteRepository` を引数で受け取る in src/features/note/application/create-note.ts、publish-note.ts、get-published-note.ts、list-notes.ts
- [X] T023 [US1] 組み立て用の関数。先頭で `import 'server-only'`。`getPublishedNote(slug)`、`listNotesForAuthor()`、`getNoteForEdit(id)`。作り手向けの2つは、先に作り手であることを確かめる in src/features/note/server/queries.ts
- [X] T024 [US1] Server Action `createNoteAction`・`editNoteAction`（編集のフォームの操作を1つにまとめ、押したボタンの `intent` が `publish` なら公開する）。ファイルの先頭で `'use server'` と `import 'server-only'`。先に作り手であることを確かめ、確かめられなければ何も書き込まずに失敗を返す。入力の誤り・slug の重複・存在しない note・失敗を、入力した値とともに返す。「作る」の成功は `/dash/notes/{id}` へ `redirect()` in src/features/note/server/actions.ts
- [X] T025 [US1] 作る・編集のフォーム（`'use client'`、`useActionState`、ラベル付きの入力、JavaScript なしで送れる。Server Action は props で受け取る）、公開済みの note の表示（本文を文字列で出し、改行を保つ）、作り手の一覧（0件の表示を含む） in src/features/note/components/note-form.tsx、published-note.tsx、note-list.tsx
- [X] T026 [US1] 訪問者の画面。`force-dynamic`、存在しなければ `notFound()`、メタデータは公開済みの値だけから作る。D1 が読めないときは 500 と読み出せなかったことの表示 in src/app/notes/[slug]/page.tsx
- [X] T027 [US1] 作り手の画面。`force-dynamic`、作り手であることを確かめられなければ `forbidden()`、`id` の note がなければ `notFound()`、D1 が読めないときは 500 と読み出せなかったことの表示。Server Action を読み込んでフォームに props で渡す in src/app/dash/page.tsx、src/app/dash/notes/new/page.tsx、src/app/dash/notes/[id]/page.tsx

**Checkpoint**: User Story 1 が単独で動き、T017〜T021 が通る

---

## Phase 4: User Story 2 - 作り手が note を書き換える (Priority: P2)

**Goal**: 作り手が note を保存し、公開済みの note は公開し直すまで訪問者に見えない

**Independent Test**: 公開済みの note の題を書き換えて公開し直し、`/notes/{slug}` に書き換えた題が出る

### Tests for User Story 2

- [X] T028 [P] [US2] ユースケース「保存する」の単体テスト。公開済みの note の slug は変えられない、存在しない note は保存しない、保存の失敗を返す in tests/unit/note-usecases.test.ts
- [X] T029 [P] [US2] 結合テスト。JWT のない「保存する」の操作の前後で D1 の行が変わらない。作り手の JWT 付きで、D1 が書き込めないときの「保存する」が失敗を返し入力した値を含む in tests/integration/dash.test.ts
- [X] T030 [P] [US2] JavaScript を切った E2E。公開済みの note を保存 → 一覧に公開し直していない書き換えがあることが出る → 公開し直す → 訪問者に書き換えた題 in tests/e2e/note-edit.spec.ts
- [X] T031 [P] [US2] 「保存する」を、キーボードだけで行う E2E と、幅 360px の画面で行う E2E in tests/e2e/note-input-methods.spec.ts

### Implementation for User Story 2

- [X] T032 [US2] ユースケース「保存する」 in src/features/note/application/save-note.ts
- [X] T033 [US2] `editNoteAction` の `intent` が `save` のときの保存と、編集のフォームの「保存する」、公開済みの note での「公開し直す」の呼び名と、slug を変えられない表示 in src/features/note/server/actions.ts と src/features/note/components/note-form.tsx

**Checkpoint**: User Story 1 と 2 が動く

---

## Phase 5: User Story 3 - 作り手が note を完全に削除する (Priority: P3)

**Goal**: 作り手が確認を経て note を削除し、訪問者に見えなくなる

**Independent Test**: 公開済みの note を削除し、`/notes/{slug}` で note がないことが伝わり、`/dash` の一覧からも消える

### Tests for User Story 3

- [X] T034 [P] [US3] ユースケース「削除する」の単体テスト。存在しない note、削除の失敗 in tests/unit/note-usecases.test.ts
- [X] T035 [P] [US3] 結合テスト。JWT のない `/dash/notes/{id}/delete` が 403、JWT のない「削除する」の操作の前後で D1 の行が変わらない。作り手の JWT 付きで、D1 が読めないときの削除の確認の画面が 500、D1 が書き込めないときの「削除する」が失敗を返す in tests/integration/dash.test.ts
- [X] T036 [P] [US3] JavaScript を切った E2E。削除の確認の画面から戻るリンクで戻ると、一覧に残り訪問者も読める → 確認の画面で削除する → 訪問者に note がないことが伝わる → 一覧から消え、削除したことが出る → 同じ slug で作れる。別のページで削除した note を保存すると、存在しないことが出る（T033 の後） in tests/e2e/note-delete.spec.ts
- [X] T037 [P] [US3] 確認の画面を経て削除することを、キーボードだけで行う E2E と、幅 360px の画面で行う E2E in tests/e2e/note-input-methods.spec.ts

### Implementation for User Story 3

- [X] T038 [US3] ユースケース「削除する」 in src/features/note/application/delete-note.ts
- [X] T039 [US3] Server Action `deleteNoteAction`（成功は `/dash?deleted=1` へ `redirect()`）と、削除の確認の画面（`force-dynamic`、作り手でなければ `forbidden()`、note がなければ `notFound()`、D1 が読めないときは 500）、一覧の画面の削除したことの表示 in src/features/note/server/actions.ts、src/app/dash/notes/[id]/delete/page.tsx、src/app/dash/page.tsx

**Checkpoint**: すべての User Story が動く

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T040 [P] 配信後の検査に足す。認証なしの `/dash` と `/dash/notes/new` が Access のログイン（`*.cloudflareaccess.com`）へ移される。service token を付けないプレビュー URL の `/` が Access のログインへ移される。`/notes/<存在しない slug>` を2回取っても `cf-cache-status` が `HIT` にならない。プレビュー URL のそのほかの検査には、`.env.local` の service token をヘッダに付ける in scripts/lib/verify-deploy.mjs、scripts/verify-deploy.mjs、tests/unit/verify-deploy.test.ts
- [X] T041 [P] マイグレーションの作り方と適用の命令、JWT の検証の secret、service token の環境変数を書く in README.md
- [X] T042 [P] デザインパターンの「手本のファイル」を、この機能で最初に書いたファイルで埋める（Repository、DTO、組み立て用の関数、Dependency Injection、ユースケースを単位にする、Anti-Corruption Layer） in docs/SOFTWARE_DESIGN.md
- [X] T043 `npm test`、`npm run test:workers`、`npm run build`、`npx tsc --noEmit`、`npx tsc --noEmit -p tests/tsconfig.json`、`npm run lint`、`npm run format:check`、`npm run test:integration:only`、`npm run test:e2e:only` をすべて通す
- [ ] T044 Cloudflare の設定: Access のアプリケーション2つ（本番の `/dash`、プレビュー全体）と service token を作り、Worker の secret を入れ、本番の D1 に `npx wrangler d1 migrations apply synsk-me --remote` を当てる。Zero Trust の組織が作られていることが前提
- [ ] T045 quickstart.md の「プレビュー URL で確かめる」をスマートフォンを含めて実行し、結果を記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup の後。すべての User Story を止める
- **User Stories (Phase 3〜5)**: Foundational の後。US2 と US3 は US1 の画面（T025、T027）の上に操作を足す。T036 は「保存する」を使うため T033 の後
- **Polish (Phase 6)**: すべての User Story の後。T044 は Zero Trust の組織が作られるまで始められない。T045 は T044 の後

### Within Each User Story

- テストを先に書き、落ちることを確かめてから実装する
- ユースケース → 組み立て用の関数と Server Action → 部品 → 画面

### Parallel Opportunities

- T003〜T006 は並行できる
- T007〜T009、T012〜T014 は並行できる
- 各 User Story のテスト（[P]）は並行できる。ただし同じファイルに書く T019・T029・T035 と、T021・T031・T037 は、それぞれ順に書く

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
3. T017〜T021 が通ることを確かめる

### Incremental Delivery

1. User Story 1 → 2 → 3 の順に足し、各段で、それまでのテストが通り続けることを確かめる
2. Phase 6 で配信の検査と文書を揃え、プレビュー URL で quickstart.md を通す

---

## Notes

- 作業ごと、または作業のまとまりごとにコミットする
- `/dash` 配下の画面と操作を足すときは、必ず作り手であることを先に確かめる（ADR-0036）
- 本番へのマージの後に確かめること（この tasks.md の範囲外）: `/notes/{slug}` の表示速度（plan.md の Complexity Tracking）、Access を有効にした後の本番のデプロイが `/dash` で止まらないこと（research.md の R7）
