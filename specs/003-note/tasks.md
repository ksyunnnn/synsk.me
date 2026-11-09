---

description: "note の実装タスク"
---

# Tasks: note

**Input**: `specs/003-note/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md、下の「共有担当と 001 への依存」

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（書き込みの経路に、オーナー以外が通れないことの検査を書く）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US7）
- **止める未決: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない

## Contents

- 共有担当と 001 への依存
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
- Implementation Strategy

---

## 共有担当と 001 への依存

003 は次のものを作らずに使う（research.md の R2）。003 のタスクは、右の列のものが `epic/219-complete-specs` に入ってから始める。

| 使うもの | 作る担当 | 003 で待つタスク |
|---|---|---|
| `note.uid`・`note_revision.uid` の migration | 共有担当 | T003 以降の D1 を使うタスク |
| `src/shared/domain/slug.ts`（`isSlug`） | 共有担当（PR #222） | T004 |
| `src/shared/components/draft-retention.tsx`（`DraftRetainingForm`） | 共有担当（001 の T072、PR #222） | T033 |
| `src/shared/server/media-storage.ts`（R2 の読み書き、形式と大きさの検査） | 共有担当 | T038・T039・T050 |
| `src/shared/server/author.ts`・`env.ts`・`form-data.ts`、`src/shared/domain/action-result.ts`・`uid.ts`・`web-url.ts`・`empty-to-null.ts`、`src/shared/components/field.tsx`・`delete-form.tsx` | 001（済み） | すべて |
| `src/proxy.ts` | 001・002（済み） | T012。既にある分岐を変えずに足す |

---

## Phase 1: Setup

**Purpose**: 003 が足す package と、検査の土台

- [ ] T001 `react-markdown@10.1.0` と `mdast-util-from-markdown@^2` を package.json の dependencies に足し、package-lock.json を更新する（research.md の R11）
- [ ] T002 [P] workerd と結合の検査が、作り物の note・版・転載先・参照先の情報（`note`・`note_revision`・`syndication`・`link_preview`）と持ち主が note の `media` の行を SQL で入れる関数と、消す関数を tests/support/note-rows.ts に作る
- [ ] T003 [P] tests/workers/migrations.test.ts に、0005 のトリガ（`note_revision_immutable`・`note_slug_fixed_after_publication`・`note_published_at_fixed`・`note_published_revision_valid`）が共有担当の migration の後も残ることを足す

---

## Phase 2: Foundational

**Purpose**: どの User Story も使う note の型・本文の読み方・Repository のインタフェース・管理画面の入口

- [ ] T004 [P] note の型、`NoteStatus`・`NoteCardImage` の `as const` の配列、入力の読み方（題 200 文字・本文 100,000 文字、説明文の空を null、識別子は `src/shared/domain/slug.ts` の `isSlug`）、一度でも公開した note の識別子の書き換えを拒む判定、題が空の版を公開しない判定を src/features/note/domain/note.ts に作る（FR-002・FR-003・FR-005・FR-010・FR-011、data-model.md の「domain の型」）
- [ ] T005 [P] T004 を tests/unit/note-domain.test.ts で確かめる（201 文字の題・100,001 文字の本文・101 文字や大文字の識別子を拒む、公開したことのある note の識別子の書き換えを拒む、題が空の公開を拒む）
- [ ] T006 [P] 本文の読み方（`mdast-util-from-markdown` で構文木にし、画像の印 `media:<id>` の id の並び、行に URL だけを書いた行の URL の並び、最初の段落の文字列を返す）を src/features/note/domain/note-body.ts に作る（research.md の R11）
- [ ] T007 [P] T006 を tests/unit/note-body.test.ts で確かめる（コードの中の画像の印と URL を拾わない、文の中の URL を拾わない、`http`・`https` でない URL を拾わない、最初の段落の改行が空白になる）
- [ ] T008 note の Repository のインタフェース（作成・編集用に読む・一覧・版の一覧と 1 つの版・開いた版と比べた保存・公開・下書きに戻す・削除・元に戻す・代表画像の出どころ・転載先の追加と削除・参照先の情報・完全に消す・訪問者向けに読む・uid と版の uid と識別子の有無）を src/features/note/domain/note-repository.ts に作る。手本は src/features/project/domain/project-repository.ts
- [ ] T009 D1 の実装の骨組み（行の型と domain の型への詰め替え、`findIdByUid`、版の uid から版の id を引く、識別子の有無）を src/features/note/server/d1-note-repository.ts に作る。行の型はこのファイルの中だけに置く（001 の research.md の R3）
- [ ] T010 組み立て用の関数の骨組み（`createNoteDeps`・`hasNoteSlug`・`hasNoteUid`・`findMissingNoteRevision`）を src/features/note/server/queries.ts に作る。`hasNoteUid` は削除した note でも真を返す（contracts/dash.md の共通）
- [ ] T011 src/app/dash/page.tsx に note の一覧（`/dash/notes`）へのリンクを足す
- [ ] T012 src/proxy.ts の matcher に `/notes/:slug` を足し、`hasNoteSlug` で `/notes/{slug}/missing` への rewrite を、`DASH_ROW_EXISTS` に `notes` を、`/dash/notes/{uid}/revisions/{revisionUid}` の有無で `.../missing` への rewrite を足す。tests/unit/proxy.test.ts に確かめを足す（research.md の R9）

**Checkpoint**: Phase 1 と 2 が終われば、User Story を始められる

---

## Phase 3: User Story 1 - note を書いて公開し、訪問者に読ませる (Priority: P1) 🎯 MVP

**Goal**: オーナーが note を作り、保存し、公開する。訪問者は `/notes/{slug}` で公開した版を読む

**Independent Test**: note を 1 件作って保存し、公開する。ログインせずに `/notes/{slug}` を開き、保存した題・説明文・本文が出る

### Tests for User Story 1

- [ ] T013 [P] [US1] 作成・保存・公開のユースケース（オーナーでない呼び出しを拒む、項目の不備を返す、題が空の公開を拒み項目で知らせる、公開したことのある note の識別子の書き換えを拒む、`conflict` を送られた値つきで返す）を、Repository の作り物の実装を渡して tests/unit/note-usecases.test.ts で確かめる（FR-003・FR-011・FR-020・FR-033）
- [ ] T014 [P] [US1] D1 の実装を tests/workers/note-repository.test.ts で確かめる: 作った note が下書きで版を 1 つ持つ、保存のたびに版が 1 つ増え前の版が保存したときのまま読める、開いた版が最も新しい版でなければ書かない、続けて 2 回の保存が通る、識別子の書き換えと版の追加が同じ `batch()` で、識別子が重なれば（削除した note を含む）どちらも書かない、公開で最も新しい版が公開した版になり `published_at` は 2 回目の公開で変わらない、訪問者向けの取り出しが公開した版だけを返す（FR-001・FR-002・FR-006〜FR-008・FR-011〜FR-013・FR-020・FR-021・SC-003、research.md の R4）
- [ ] T015 [P] [US1] tests/integration/notes.test.ts で確かめる: 下書きの `/notes/{slug}` が 404 で HTML と RSC の応答に題・説明文・本文が無い、公開すると 200 で題・説明文・本文が出る、公開した後に保存した版が応答に無い、公開し直すと直した本文が出て初めて公開した日時が変わらない、本文に書いた HTML が要素にならない、説明文が空なら本文の最初の段落が説明に出る、JWT のない `/dash/notes` が 403 で `no-store`、JWT のない `createNote`・`saveNote`・`publishNote` が D1 を変えない（SC-001・SC-004・FR-004・FR-012・FR-015・FR-033、User Story 1 の 1〜5、U4 の決定）
- [ ] T016 [P] [US1] オーナーとして note を作り、保存し、公開し、識別子の入力が読み取りだけになることを tests/e2e/note.spec.ts で確かめる。キーボードだけで同じ操作ができる（User Story 1 の 6、constitution V）

### Implementation for User Story 1

- [ ] T017 [US1] 作成（`note` と 1 つ目の版を 1 回の `batch()`）・編集用の読み出し（最も新しい版と転載先）・一覧・保存（research.md の R4 の条件つき INSERT と識別子の UPDATE）・公開（R5）・訪問者向けの取り出し（R7、contracts/visitor-note.md の DTO）を src/features/note/server/d1-note-repository.ts に足す
- [ ] T018 [US1] ユースケース deps.ts・create-note.ts・save-note.ts・publish-note.ts・get-note-for-edit.ts・list-notes.ts・get-visitor-note.ts を src/features/note/application/ に作る。読む→計算→書くの順（docs/SOFTWARE_DESIGN.md）
- [ ] T019 [US1] Server Action `createNote`・`saveNote`・`publishNote` を src/features/note/server/actions.ts に作る。先頭でオーナーを確かめ、uid と開いた版の uid を隠しフィールドから読む（contracts/dash.md）。組み立て用の関数 `getVisitorNote`・`getNoteForEdit`・`listNotes` を src/features/note/server/queries.ts に足す
- [ ] T020 [P] [US1] 入力（識別子・題・説明文・本文・開いた版の uid の隠しフィールド。一度でも公開したら識別子を読み取りだけで出す。保存を止めたときの知らせ）を src/features/note/components/note-form.tsx に、公開の操作を src/features/note/components/note-status-form.tsx に作る
- [ ] T021 [P] [US1] 本文の表示（`react-markdown`、`rehype-raw` を使わず `urlTransform` を既定のまま。画像の印は T040 で足すまで出さない）を src/features/note/components/note-body.tsx に、訪問者向けの note の表示を src/features/note/components/visitor-note.tsx に作る（research.md の R11）
- [ ] T022 [US1] ページを作る: src/app/notes/[slug]/page.tsx（`generateMetadata` は DTO の題と、説明文か本文の最初の段落だけを使う）・src/app/notes/[slug]/missing/page.tsx（`notFound()` だけ）・src/app/dash/notes/page.tsx・new/page.tsx・[id]/page.tsx・[id]/missing/page.tsx。管理画面のページは描画の前にオーナーを確かめる

**Checkpoint**: User Story 1 が単独で動く

---

## Phase 4: User Story 2 - 公開をやめる・削除する・削除を戻す (Priority: P1)

**Goal**: 公開した note を下書きに戻し、note を削除し、元に戻す。下書きに戻した note と削除した note は訪問者に見えない

**Independent Test**: 公開した note を下書きに戻し、`/notes/{slug}` の応答に中身が無い。別の note を削除し、応答に中身が無い。元に戻すと削除前の状態に戻る

### Tests for User Story 2

- [ ] T023 [P] [US2] 下書きに戻す・削除・元に戻すのユースケース（オーナーでない呼び出しを拒む、削除した note への保存・公開を `not-found` にする）を tests/unit/note-usecases.test.ts に、D1 の実装（下書きに戻しても公開した版と初めて公開した日時が残る、削除しても状態と版が残る、元に戻すと削除前の状態と版と識別子、削除した note の識別子で別の note を作れない）を tests/workers/note-repository.test.ts に足す（FR-014・FR-016・SC-007、User Story 2 の 2・4〜6）
- [ ] T024 [P] [US2] tests/integration/notes.test.ts に足す: 下書きに戻した note と削除した note の `/notes/{slug}` が 404 で中身が無い、公開した note を削除して元に戻すと同じ版が 200 で出る、JWT のない `unpublishNote`・`deleteNote`・`restoreNote` が D1 を変えない（SC-001・FR-033、User Story 2 の 1・3・5）

### Implementation for User Story 2

- [ ] T025 [US2] 下書きに戻す・削除・元に戻すを src/features/note/server/d1-note-repository.ts に、ユースケース unpublish-note.ts・delete-note.ts・restore-note.ts を src/features/note/application/ に、Server Action `unpublishNote`・`deleteNote`・`restoreNote` を src/features/note/server/actions.ts に足す（research.md の R5）
- [ ] T026 [US2] 削除の確認のページ src/app/dash/notes/[id]/delete/page.tsx を src/shared/components/delete-form.tsx で作り、編集の画面に下書きに戻す操作を、削除した note の編集の画面に中身の読み取りと「元に戻す」だけを、一覧に削除したかを足す

**Checkpoint**: User Story 1・2 が動き、公開した内容を引っ込められる

---

## Phase 5: User Story 3 - 過去の版を残し、戻す (Priority: P2)

**Goal**: オーナーが版の一覧と過去の版を見て、その版に戻す

**Independent Test**: note を 3 回保存し、3 つの版が保存したときのまま読める。1 つ目の版に戻すと 4 つ目の版として足される

### Tests for User Story 3

- [ ] T027 [P] [US3] D1 の実装（版の一覧が新しい順、1 つの版の読み出しが別の note の版を返さない、戻すと戻した版の中身が新しい版として足され 3 つの版が残る、開いた版が最も新しい版でなければ戻さない、公開した版が変わらない）を tests/workers/note-repository.test.ts に足す（FR-008・FR-009、User Story 3 の 1・2）
- [ ] T028 [P] [US3] 公開した note を過去の版に戻し公開し直さないと、`/notes/{slug}` に戻す前に公開していた版が出ること、JWT のない `revertNote` が D1 を変えないことを tests/integration/notes.test.ts に足す（FR-009・FR-033、User Story 3 の 3）

### Implementation for User Story 3

- [ ] T029 [US3] 版の一覧・1 つの版・戻すを src/features/note/server/d1-note-repository.ts に、ユースケース list-note-revisions.ts・revert-note.ts を src/features/note/application/ に、Server Action `revertNote` を src/features/note/server/actions.ts に足す
- [ ] T030 [US3] 版の一覧の部品を src/features/note/components/note-revision-list.tsx に作り、ページ src/app/dash/notes/[id]/revisions/page.tsx・[id]/revisions/[revisionId]/page.tsx（「この版に戻す」）・[id]/revisions/[revisionId]/missing/page.tsx を作る

---

## Phase 6: User Story 4 - 書いている内容を失わない (Priority: P2)

**Goal**: 書きかけの内容がその端末に残り、別の画面で先に保存されたら後の保存が止まって内容が残る

**Independent Test**: 同じ note を 2 つのタブで開き、片方で保存した後にもう片方で保存する。2 つ目の保存が止まり、知らせが出て、入力が残る

### Tests for User Story 4

- [ ] T031 [P] [US4] 2 つのタブで同じ note を開き、後から保存した側が止まり、知らせが出て、入力が残ること、1 つのタブで続けて 2 回保存すると 2 回とも保存されることを tests/e2e/note-concurrency.spec.ts で確かめる（FR-020・FR-021・SC-002、User Story 4 の 3・4）
- [ ] T032 [P] [US4] 本文を書きかけて保存せずに再読み込みすると書きかけが残ること、別のブラウザの文脈（別の端末にあたる）で開くと最後に保存した版が出ること、保存を止められたときに書きかけが消えないことを tests/e2e/note-draft.spec.ts で確かめる（FR-018・FR-019、User Story 4 の 1・2、spec の Edge Cases）

### Implementation for User Story 4

- [ ] T033 [US4] src/features/note/components/note-form.tsx の `<form>` を共有担当の src/shared/components/draft-retention.tsx の `DraftRetainingForm` に置き換え、`storageKey` に `note:<note の uid>`、`version` に開いた版の uid、`result` に Server Action の結果を渡す（research.md の R10）

---

## Phase 7: User Story 5 - 本文に画像を置き、代表画像を選ぶ (Priority: P2)

**Goal**: 本文に画像を置き、代表画像を自動で作る画像・note の画像・サイト共通の画像から選ぶ

**Independent Test**: 本文に画像を 1 枚置いて公開し、訪問者に画像が出る。代表画像をその画像にし、OGP にその画像が出る

### Tests for User Story 5

- [ ] T034 [P] [US5] D1 の実装（代表画像の既定が `generated`、`site` に変えられる、別の note の画像を代表画像に選べない）を tests/workers/note-repository.test.ts に足す。画像の行は tests/support/note-rows.ts で入れる（FR-024・FR-025、User Story 5 の 3）
- [ ] T035 [P] [US5] 代表画像を `site` にした note の OGP にサイト共通の画像が出ること、JWT のない `changeNoteCardImage` が D1 を変えないことを tests/integration/notes.test.ts に足す（FR-024・FR-033）

### Implementation for User Story 5

- [ ] T036 [US5] 代表画像の出どころの変更（`generated` と `site`）を Repository・ユースケース change-note-card-image.ts・Server Action `changeNoteCardImage`・src/features/note/components/note-card-image-form.tsx に作り、src/app/notes/[slug]/page.tsx の `generateMetadata` に `site` のときのサイト共通の画像を足す（research.md の R12）
- [ ] T037 [US5] 題を入れて自動で作る代表画像を作り、一度作ったものを使い回す（`docs/CRAWLING.md` の「取得の負荷」）。**止める未決: U8**
- [ ] T038 [US5] 画像の追加（ユースケース add-note-media.ts、Server Action `addNoteMedia`。共有担当の src/shared/server/media-storage.ts で R2 に置き、持ち主が note の `media` を足す。1 回の操作で 1 枚。JPEG・PNG・WebP・GIF・10 MB までの検査は media-storage.ts が持ち、その検査で確かめる）と、代表画像に note の画像を選ぶ入力を作る。media-storage.ts が拒んだ画像を項目の誤りで返すことを tests/unit/note-usecases.test.ts で、別の note の画像を代表画像に選べないことを tests/workers/note-repository.test.ts で確かめる（FR-023・FR-025、research.md の R12、constitution の Test Layering）
- [ ] T039 [US5] note の画像を配る経路 src/app/notes/[slug]/media/[key]/route.ts と、ユースケース get-visitor-note-media.ts、src/proxy.ts の `/notes/{slug}/media/{key}` の判定を作る。公開で削除していない note の、公開した版の本文が指す画像（src/features/note/domain/note-body.ts で読む）と代表画像だけを、R2 の原本のまま返す。下書き・削除した note の画像、公開した後に保存した版にだけ置いた画像、別の note の画像が 404 で `no-store` を持つことを tests/integration/notes.test.ts で確かめる（FR-026・SC-001、User Story 5 の 1・4・5）
- [ ] T040 [US5] src/features/note/components/note-body.tsx で画像の印を `<figure>`・`<img alt>`・`<figcaption>` で出し、`src` を T039 の経路にする。本文の元の文字列（`media:<id>`）が RSC の応答に含まれないことを tests/integration/notes.test.ts で確かめる（research.md の R11）

---

## Phase 8: User Story 6 - 参照先の URL をカードで見せる (Priority: P3)

**Goal**: 行に URL だけを書いた行を、参照先の題と画像を添えたカードで出す

**Independent Test**: 本文に参照先の URL を書いた note を公開し、カードで出る。表示のたびに参照先へ取りに行かない

### Tests for User Story 6

- [ ] T041 [P] [US6] 参照先の情報の読み書き（URL ごとに 1 行、取り直すと同じ行が変わり 2 つの note のどちらからも取り直した中身が読める、画像は URL だけ）を tests/workers/note-repository.test.ts に足す（FR-028〜FR-030、User Story 6 の 3）

### Implementation for User Story 6

- [ ] T042 [US6] 参照先の情報を URL の並びで読む処理と、URL ごとに書く処理を src/features/note/server/d1-note-repository.ts に足す
- [ ] T043 [US6] 参照先への取得を作る。取得した HTML を取得のモジュールの中で題と画像の URL に詰め替える（Anti-Corruption Layer）。1 回の保存で取りに行く URL の数・1 回の取得の時間と大きさの上限を plan.md に書いてから作る（FR-027、constitution II・VII、research.md の R13）。**止める未決: U9**
- [ ] T044 [US6] src/features/note/components/note-body.tsx で、行に URL だけを書いた行を `link_preview` の題と画像を添えたカードで出し、URL カードを含む note の表示で参照先への `fetch` が 0 回であることを tests/integration/notes.test.ts で確かめる（FR-027・FR-028・SC-005、User Story 6 の 1・2）。**止める未決: U9**

---

## Phase 9: User Story 7 - 転載先を記録する (Priority: P3)

**Goal**: note に転載先の URL を記録する

**Independent Test**: note に転載先の URL を 1 つ記録し、同じ URL を別の note に記録できない

### Tests for User Story 7

- [ ] T045 [P] [US7] D1 の実装（2 つ記録できる、同じ URL を同じ note と別の note に記録できない、URL で指して外せる、別の note の URL を外さない）を tests/workers/note-repository.test.ts に、ユースケース（http・https でない URL を拒む、オーナーでない呼び出しを拒む）を tests/unit/note-usecases.test.ts に足す（FR-031・FR-032・FR-033、User Story 7）
- [ ] T046 [P] [US7] オーナーとして転載先を 2 つ記録し、同じ URL を別の note に記録すると拒まれることを tests/e2e/note.spec.ts に足し、JWT のない `addNoteSyndication`・`removeNoteSyndication` が D1 を変えないことを tests/integration/notes.test.ts に足す

### Implementation for User Story 7

- [ ] T047 [US7] 転載先の追加と削除を Repository・ユースケース add-note-syndication.ts・remove-note-syndication.ts・Server Action `addNoteSyndication`・`removeNoteSyndication`・src/features/note/components/note-syndication-form.tsx に作る。外すフォームは URL を送る（research.md の R14）。訪問者の DTO に入れない（U11）

---

## Phase 10: Polish

- [ ] T048 [P] 完全に消す処理（1 回の `batch()` で `media`・`syndication`・`note_revision`・`note` の順。`link_preview` は残す）を src/features/note/server/d1-note-repository.ts に足し、公開した note と代表画像を持つ note を消せること、途中の文が失敗すると何も消えないことを tests/workers/note-repository.test.ts で確かめる。画面は作らない（FR-017、REQUIREMENTS.md の FR-11、research.md の R6）
- [ ] T049 [P] 見た目の確認のページ src/app/dash/notes/[id]/preview/page.tsx を、最も新しい版を訪問者向けの部品で描く形で作り、下書きの note でも最も新しい版が出ることを tests/integration/notes.test.ts で確かめる（REQUIREMENTS.md の FR-13、research.md の R15）
- [ ] T050 完全に消すときに、D1 の削除の後で R2 の画像の実体を共有担当の src/shared/server/media-storage.ts で消す（FR-017、research.md の R6）
- [ ] T051 [P] スマートフォンの端末の設定で、note を作り、保存し、公開するまでを tests/e2e/note-mobile.spec.ts で確かめる（FR-022・SC-006、research.md の R16）
- [ ] T052 [P] tests/integration/dash-url-without-id.test.ts に、`/dash/notes` 配下のリンク・303 の行き先・隠しフィールドに数字だけの識別子が出ないことを足す（ADR-0051）
- [ ] T053 quickstart.md の「手で確かめる」をブランチの Preview で行う

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → User Story の各段階 → Polish
- Phase 2 は「共有担当と 001 への依存」の migration と slug の検査を待つ

### User Story Dependencies

- US1: Phase 2 の後。ほかに依存しない
- US2: US1 に依存（公開した note を使う）
- US3: US1 に依存（保存した版を使う）。US2 と並べられる
- US4: US1 に依存（保存の画面）。T033 は共有担当の書きかけの保持の部品を待つ
- US5: US1 に依存。T037 だけが U8 を待つ
- US6: US1 に依存。T041・T042 は U9 を待たない
- US7: US1 に依存。US2〜US6 と並べられる

### 未決が止めるタスク

| 未決 | 止めるタスク |
|---|---|
| U8 | T037 |
| U9 | T043・T044 |
| U1〜U7・U10〜U14 | 無し |

### Within Each User Story

- 検査を先に書き、落ちることを確かめてから実装する
- domain → application → server → components → app の順

### Parallel Opportunities

- Phase 1: T002・T003 は別のファイル
- Phase 2: T004〜T007 は別のファイル
- 各 User Story の検査のタスク（[P]）は並べられる
- US2・US3・US7 は US1 の後に並べられる

## Parallel Example: User Story 1

```text
T013 tests/unit/note-usecases.test.ts
T014 tests/workers/note-repository.test.ts
T015 tests/integration/notes.test.ts
T016 tests/e2e/note.spec.ts
↓
T017 src/features/note/server/d1-note-repository.ts
↓
T018 → T019、T020・T021 は並べる → T022
```

## Implementation Strategy

### MVP First

1. Phase 1・2
2. Phase 3（US1）で、note を作り、保存し、公開し、訪問者が読む
3. Phase 4（US2）を足す。US1・US2 を終えるまで main にマージしない（公開した内容を引っ込められることを確かめてから出す）

### Incremental Delivery

US1+US2 → US3・US4 → US7 → US5（U8 を待たない部分）→ US6（U9 を待たない部分）→ Polish。各段階を Preview で確かめてからマージする

## Notes

- 機能どうしは import しない（ADR-0026）。一覧（005）は note を `activity_feed` のビューで読む（research.md の R3）
- 書き込みの Server Action は、先頭でオーナーを確かめる。呼び忘れは型でも lint でも検出しない（ADR-0036 の Consequences）ため、結合の検査で各 Server Action を確かめる
- コミットはタスクか論理のまとまりごと
