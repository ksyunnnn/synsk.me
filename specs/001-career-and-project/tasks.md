---

description: "職歴と実績の実装タスク"
---

# Tasks: 職歴と実績

**Input**: `specs/001-career-and-project/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（書き込みの経路に、オーナー以外が通れないことの検査を書く）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US5）
- **止める未決: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない

## Contents

- Phase 1: Setup（build を通す）
- Phase 2: Foundational
- Phase 3: User Story 1（P1）
- Phase 4: User Story 2（P1）
- Phase 5: User Story 3（P2）
- Phase 6: User Story 4（P2）
- Phase 7: User Story 5（P3）
- Phase 8: Polish
- Dependencies & Execution Order
- Implementation Strategy

---

## Phase 1: Setup（build を通す）

**Purpose**: feature/72-rebuild の `npm run build`・型検査・検査の土台を通す。オーナーの判定は ADR-0013・ADR-0036 に沿って作り直す。note に固有の部分（`/notes/*`、`/dash/notes/*`、note の作り物の行）は 003 が持つため作らない

- [X] T001 `migrations/0008_rebuild_career_project_and_resume.sql` が feature/72-rebuild に入っていることを確かめる。入っていなければオーナーに伝え、D1 を使う検査のタスク（workerd・結合・E2E）を止める（research.md の R1）
- [X] T002 `cloudflare:workers` の env を使うときに読み込む関数を src/shared/server/env.ts に作る。先頭で `import 'server-only'`。モジュールの先頭で `cloudflare:workers` を読み込まない（`vinext build` が Node で読み込むため）。Access の設定値（`ACCESS_ISSUER`・`ACCESS_AUD`・`ACCESS_OWNER_EMAIL`）の型をここに置く
- [X] T003 Access の JWT を `jose` で検証して `Author` を返す関数（要求のヘッダから・`headers()` から）を src/shared/server/author.ts に作る。署名・発行元・aud（カンマ区切りの複数）・期限・メールアドレス（ローカル部は大文字と小文字を区別し、ドメインは ASCII の英字だけ畳む）を確かめ、設定値が欠ければ null。JWT の型をファイルの外に出さない（constitution VII）
- [X] T004 [P] T003 の分岐（JWT なし・署名違い・発行元違い・aud 違い・期限切れ・別のメールアドレス・設定値の欠け・正しい JWT）を tests/unit/author.test.ts で確かめる。鍵は tests/support/access.ts の `createAccessTestKeys` を使う
- [X] T005 src/proxy.ts を作り直す。matcher は `/dash` と `/dash/:path*`。オーナーでなければ `/dash/forbidden` へ rewrite し、`/dash` 配下の応答に `Cache-Control: no-store, must-revalidate` を付ける。判定は T003 の関数を呼ぶ。D1 や設定値の読み出しで例外が出たら判定せずに通す（`/dash` のページがオーナーを確かめる）。`@/features/note/*` を読まない
- [X] T006 tests/unit/proxy.test.ts を T005 に合わせて書き直す。`@/features/note/server/queries` のモックを外し、T003 の関数をモックする。matcher・403 の rewrite・`no-store` を確かめる
- [X] T007 [P] tests/e2e/support/author.ts を作り直す。playwright.config.ts が読む `ACCESS_CERTS_URL` と `D1_PERSIST_DIR` と、tests/e2e/forbidden-navigation.spec.ts が読む `actAsAuthor` を持つ。tests/support/access.ts を使う
- [X] T008 tests/e2e/forbidden-navigation.spec.ts のリンク名「新しい note を作る」を、src/app/dash/page.tsx（T014）の入口のリンクに合わせる
- [X] T009 [P] tests/integration/support/d1.ts を、note に依らない形で作り直す。本番ビルドを `createTestHarness()` で起動し、手元の D1 に `migrations/` を当て、作り物の行を入れる関数を持つ
- [X] T010 tests/integration/private-responses.test.ts から note の検査を外し、JWT のない `/dash` が 403 で `no-store` を持つこと（NFR-09）を T009 で確かめる形にする。note の検査は 003 が持つ
- [X] T011 [P] tests/workers/migrations.test.ts を作り、`TEST_MIGRATIONS` を当てた D1 に 0008 の後の表（`organization.name_masked` が NULL 可、`skill.months_override`、`project.is_highlighted` が無い）があることを確かめる。`npm run test:workers` が「テストが無い」で落ちないようにする
- [X] T012 `npx tsc --noEmit` の誤りを無くす。src/app/page.tsx の `cacheLife` の import と、`.next/types` に残った消したページ（`src/app/archives/*`）の型を調べ、直す
- [X] T013 `npm run build`・`npx tsc --noEmit`・`npm run lint`・`npm run format:check`・`npm test`・`npm run test:workers` が通ることを確かめる

---

## Phase 2: Foundational

**Purpose**: どの User Story も使う管理画面の入口・期間・組織・入力の部品

- [X] T014 管理画面の入口を src/app/dash/page.tsx に作る。描画の前に src/shared/server/author.ts でオーナーを確かめ、オーナーでなければ `forbidden()`。職歴・実績・学歴・スキル・組織の一覧へのリンクを置く（contracts/dash.md）
- [X] T015 [P] 期間の型と、日付の形（`YYYY-MM-DD`）・終わりの日が始まりの日より前でないことの判定を src/shared/domain/period.ts に作る（FR-038・FR-039）。経験年数と重なりの計算はここに置くが、U6 が解けるまで書かない
- [X] T016 [P] T015 を tests/unit/period.test.ts で確かめる（終わりの日が空・同じ日・逆の日・読めない日付）
- [X] T017 [P] 組織の型と、秘匿化した職歴・実績が指す組織は秘匿化した組織名を持つという判定（FR-001）と、個人の組織の id の定数（値は T073 で入れる。それまでは誰も指さない値）を src/shared/domain/organization.ts に作る
- [X] T018 [P] T017 の判定を tests/unit/organization.test.ts で確かめる
- [X] T019 組織の Repository のインタフェース（組織名の一覧・名前で探して無ければ作る・id で読む）を src/shared/domain/organization.ts に、D1 の実装を src/shared/server/organization-repository.ts に作る。行の型は実装のファイルの中だけに置く（research.md の R3）
- [X] T020 T019 を tests/workers/organization-repository.test.ts で確かめる（同じ名前で探すと同じ行、新しい名前で作る、秘匿化した組織名は空で作れる）
- [X] T021 [P] workerd と結合の検査が作り物の組織・職歴・実績・学歴・スキルの行を入れる関数を tests/support/career-and-project-rows.ts に作る。個人の組織は T017 の定数の id で入れる
- [X] T022 [P] ネイティブの入力の要素に、ラベル・項目ごとの誤りの表示・フォーカスの見た目をかぶせた部品を src/shared/components/field.tsx に作る（`design/guidelines.md` の Inputs、トークンの名前で値を使う）
- [X] T023 Server Action の結果の型（成功・オーナーでない・項目ごとの誤りと送られた値・先に書き換えられていた）を src/shared/domain/action-result.ts に作る（contracts/dash.md の共通）

**Checkpoint**: Phase 1 と 2 が終われば、User Story を並べて始められる

---

## Phase 3: User Story 1 - 実績を登録し、個別のページで見せる (Priority: P1) 🎯 MVP

**Goal**: オーナーが実績を登録・編集・削除し、訪問者が `/projects/{slug}` で秘匿化しない実績を見る

**Independent Test**: 秘匿化しない実績を 1 件登録し、訪問者として `/projects/{slug}` を開いて、題・組織名・期間が登録した値で出る。無い識別子は 404

### Tests for User Story 1

- [X] T024 [P] [US1] 実績の domain（登録の識別子が uid で FR-013 の形、識別子の形の判定、種類の 4 値、期間）を tests/unit/project-domain.test.ts で確かめる
- [X] T025 [P] [US1] 実績のユースケース（登録・編集・削除・オーナーでない呼び出しを拒む）を、Repository の作り物の実装を渡して tests/unit/project-usecases.test.ts で確かめる
- [X] T026 [P] [US1] 実績の D1 の実装（登録・同じ識別子の拒否・編集・楽観ロックで先に書き換えられていたら何も書かない・削除の順序で `resume_project.project_id` を空にしてから消す）を tests/workers/project-repository.test.ts で確かめる（FR-011・FR-013・FR-042、research.md の R7・R8）
- [X] T027 [P] [US1] `/projects/{slug}` の 200 と、無い識別子の 404、JWT のない実績の Server Action が 403 の結果で D1 を変えないことを tests/integration/projects.test.ts で確かめる（FR-014・FR-040・SC-002）
- [X] T028 [P] [US1] tests/unit/proxy.test.ts に、無い識別子の `/projects/{slug}` を `/projects/{slug}/missing` へ、無い uid の `/dash/projects/{uid}` を `/dash/projects/{uid}/missing` へ rewrite することを足す

### Implementation for User Story 1

- [X] T029 [P] [US1] 実績の型・種類の `as const` の配列・識別子の決まり（uid の生成は `crypto.randomUUID()`）を src/features/project/domain/project.ts に作る
- [X] T030 [P] [US1] 実績の Repository のインタフェース（訪問者向けに識別子で読む・編集用に id で読む・一覧・登録・開いたときの更新日時つきの編集・削除・識別子と id の有無）を src/features/project/domain/project-repository.ts に作る
- [X] T031 [US1] ユースケースを src/features/project/application/ に 1 つずつ作る: register-project.ts・edit-project.ts・delete-project.ts・get-visitor-project.ts・get-project-for-edit.ts・list-projects.ts。読む→計算→書くの順（docs/SOFTWARE_DESIGN.md）
- [X] T032 [US1] D1 の実装を src/features/project/server/d1-project-repository.ts に作る。編集は research.md の R7、削除は R8 の順で 1 つの `batch()`。組織は src/shared/server/organization-repository.ts で探すか作る
- [X] T033 [US1] 組み立て用の関数（訪問者向けの取り出し、識別子と id の有無）を src/features/project/server/queries.ts に、Server Action（`registerProject`・`editProject`・`deleteProject`）を src/features/project/server/actions.ts に作る。Server Action は先頭でオーナーを確かめる
- [X] T034 [US1] src/proxy.ts の matcher に `/projects/:slug` を足し、T033 の有無の関数で 404 の rewrite を足す。`/dash/projects/{uid}` の有無も見る
- [X] T035 [P] [US1] 訪問者向けの実績の表示（秘匿化しない側）を src/features/project/components/visitor-project.tsx に作る。本文は U4 が解けるまで出さない
- [X] T036 [P] [US1] 実績の入力（組織名・種類・題・秘匿化した題・秘匿化するか・期間・本文・関連 URL）を src/features/project/components/project-form.tsx に作る。組織名は U3 が解けるまでネイティブの `input type="text"`。失敗の結果では送られた値を残す
- [X] T037 [US1] 訪問者のページを src/app/projects/[slug]/page.tsx（`generateMetadata` も DTO の値だけを使う）と src/app/projects/[slug]/missing/page.tsx（`notFound()` だけ）に作る
- [X] T038 [US1] 管理画面のページを src/app/dash/projects/page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作る。各ページは描画の前にオーナーを確かめる

**Checkpoint**: User Story 1 が単独で動く

---

## Phase 4: User Story 2 - 秘匿化した職歴・実績を、実際の値を出さずに見せる (Priority: P1)

**Goal**: 秘匿化した実績を、秘匿化した題と秘匿化した組織名で出し、隠す値を応答に含めない。職歴の訪問者側は 005 が確かめる（research.md の R15）

**Independent Test**: 秘匿化した実績を登録し、`/projects/{slug}` の HTML と RSC の応答に、実際の題・実際の組織名・本文の中身・関連 URL・画像が含まれない

### Tests for User Story 2

- [X] T039 [P] [US2] 秘匿化の決まり（秘匿化した実績の識別子の書き換えを拒む、秘匿化に切り替えると新しい uid、秘匿化した組織名の無い組織で秘匿化しない）を tests/unit/project-masking.test.ts で確かめる（FR-001・FR-013）
- [X] T040 [P] [US2] 訪問者向けの取り出しが、秘匿化した実績で `title`・`organization.name`・`description`・`url`・代表画像を返さないこと、秘匿化を指定しない登録が秘匿化されることを tests/workers/project-masking.test.ts で確かめる（FR-015・FR-026）
- [X] T041 [P] [US2] 秘匿化した実績のページの HTML と RSC の応答（`<title>`・OGP を含む）に隠す値が 0 件であること、秘匿化しない実績では実際の値が出ること、秘匿化を切り替えた直後の要求で新しい状態が出ること（古い識別子は 404）を tests/integration/project-masking.test.ts で確かめる（SC-001・FR-023・FR-043）

### Implementation for User Story 2

- [X] T042 [US2] src/features/project/server/d1-project-repository.ts の訪問者向けの取り出しを、`is_masked` で SELECT する列を分ける形にし、contracts/visitor-project.md の 2 つの DTO に詰める
- [X] T043 [US2] src/features/project/application/edit-project.ts に、秘匿化に切り替えたときの新しい uid、秘匿化した実績の識別子の書き換えの拒否、FR-001 の判定（src/shared/domain/organization.ts）を足す。register-project.ts にも FR-001 の判定を足す
- [X] T044 [US2] src/features/project/components/visitor-project.tsx に秘匿化した側の表示を足す。本文を伏せた見た目は U7 が解けるまで出さない
- [X] T045 [US2] src/features/project/components/project-form.tsx で、秘匿化するときに組織の秘匿化した組織名を入れられるようにし、秘匿化した実績の識別子の入力を読み取りだけにする
- [X] T046 [US2] 本文を伏せた見た目を src/features/project/components/visitor-project.tsx に作る。本文の場所に「非公開」と出す（FR-021）

**Checkpoint**: User Story 1 と 2 が単独で動く

---

## Phase 5: User Story 3 - 組織を表記をぶらさずに登録する (Priority: P2)

**Goal**: 組織名を選ぶか入力し、組織名を直すと指す職歴と実績に反映する

**Independent Test**: 組織名を 1 つ入れて実績を登録し、2 件目の入力で選択肢に出ること、組織名を直すと実績のページの組織名が変わること

### Tests for User Story 3

- [X] T047 [P] [US3] 組織の編集と削除（同じ名前の拒否、指されている組織と個人の組織を消せない、秘匿化した職歴・実績が指すのに秘匿化した組織名を空にできない）を tests/workers/organization-edit.test.ts で確かめる（FR-001・FR-003・FR-006・FR-041）
- [X] T048 [P] [US3] 組織名を直した直後に、実績のページが直した組織名を出すことと、JWT のない組織の Server Action が D1 を変えないことを tests/integration/organizations.test.ts で確かめる（FR-004・SC-003・FR-040）

### Implementation for User Story 3

- [X] T049 [US3] src/shared/server/organization-repository.ts に、組織名と秘匿化した組織名の編集・削除・指している職歴と実績の有無を足す
- [X] T050 [US3] 組織のユースケース（edit-organization.ts・delete-organization.ts・list-organizations.ts）を src/features/organization/application/ に、組み立て用の関数と Server Action を src/features/organization/server/queries.ts・actions.ts に作る
- [X] T051 [P] [US3] 組織の編集の入力を src/features/organization/components/organization-form.tsx に作る
- [X] T052 [US3] 管理画面のページを src/app/dash/organizations/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作り、src/proxy.ts に `/dash/organizations/{uid}` の有無を足す
- [ ] T053 [US3] 組織名の選択肢を出す入力の部品を src/shared/components/ に作り、src/features/project/components/project-form.tsx と src/features/career/components/career-form.tsx の組織名に使う。E2E で選択肢が出ることとキーボードで選べることを tests/e2e/organization-input.spec.ts で確かめる（FR-002）。**止める未決: U3**

---

## Phase 6: User Story 4 - スキルと経験年数を管理する (Priority: P2)

**Goal**: スキルを登録し、実績につなぎ、経験年数を求めるか上書きする

**Independent Test**: 期間が重なる 2 件の実績に同じスキルをつなぎ、求めた経験年数が重なりを除いた長さから求めた値になる。上書きするとその値になる

### Tests for User Story 4

- [X] T054 [P] [US4] スキルの D1 の実装（大文字と小文字だけ違う名前の拒否、上書きの月数の保存、削除で `project_skill` を先に消す）と、実績へのスキルのつなぎ（0 個以上）を tests/workers/skill-repository.test.ts で確かめる（FR-031・FR-032・FR-034）
- [ ] T055 [P] [US4] 経験年数の計算を tests/unit/period-experience.test.ts で確かめる。SC-004 の組（重ならない・一部重なる・一方が他方を含む・終わりの日が空）と、上書きの月数を使うこと。職歴の実績とスキル（同じ組織で期間が重なる）も確かめる（FR-017・FR-033〜FR-035）。職歴の実績とスキルの部分だけ **止める未決: U6 の残り（端の扱い）**

### Implementation for User Story 4

- [X] T056 [P] [US4] スキルの型と Repository のインタフェースを src/features/skill/domain/skill.ts・skill-repository.ts に、D1 の実装を src/features/skill/server/d1-skill-repository.ts に作る
- [X] T057 [US4] スキルのユースケース（register-skill.ts・edit-skill.ts・delete-skill.ts・list-skills.ts）を src/features/skill/application/ に、組み立て用の関数と Server Action を src/features/skill/server/queries.ts・actions.ts に作る。上書きは年と月で受け取り、月数で保存する
- [X] T058 [P] [US4] スキルの入力（名前・上書きの年と月）を src/features/skill/components/skill-form.tsx に作る
- [X] T059 [US4] 管理画面のページを src/app/dash/skills/page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作り、src/proxy.ts に `/dash/skills/{uid}` の有無を足す
- [X] T060 [US4] 実績の入力に、スキルをつなぐチェックボックスの並びを足す（src/features/project/components/project-form.tsx）。src/features/project/server/d1-project-repository.ts の登録と編集で `project_skill` を入れ直し、research.md の R7 の条件を付ける。訪問者向けの DTO の `skills` を埋める
- [ ] T061 [US4] 経験年数の計算と、職歴の実績とスキルの求め方を src/shared/domain/period.ts に作り、スキルの一覧の画面（src/app/dash/skills/page.tsx）に年と月で出す。職歴の実績とスキルの求め方だけ **止める未決: U6 の残り（端の扱い）**

---

## Phase 7: User Story 5 - 職歴と学歴を登録する (Priority: P3)

**Goal**: 職歴と学歴を登録・編集・削除する

**Independent Test**: 職歴と学歴を 1 件ずつ登録・編集し、管理画面で読めること、学歴が実績のページの応答に含まれないこと

### Tests for User Story 5

- [X] T062 [P] [US5] 職歴の D1 の実装（終わりの日が空、既定で秘匿化、秘匿化した組織名の無い組織で秘匿化しない、楽観ロック、削除で `resume_career.career_id` を空にしてから消す）を tests/workers/career-repository.test.ts で確かめる（FR-001・FR-007・FR-008・FR-010・FR-042）
- [X] T063 [P] [US5] 学歴の D1 の実装（学部・終わりの日・備考が空、前後の逆の拒否、削除で `resume_education.education_id` を空にしてから消す）を tests/workers/education-repository.test.ts で確かめる（FR-036・FR-039）
- [X] T064 [P] [US5] 学歴の学校名が実績のページの応答に含まれないことと、JWT のない職歴・学歴の Server Action が D1 を変えないことを tests/integration/careers-and-educations.test.ts で確かめる（FR-037・SC-005・FR-040）

### Implementation for User Story 5

- [X] T065 [P] [US5] 職歴の型・Repository のインタフェース・D1 の実装を src/features/career/domain/career.ts・career-repository.ts・src/features/career/server/d1-career-repository.ts に作る。編集は research.md の R7、削除は R8
- [X] T066 [US5] 職歴のユースケース（register-career.ts・edit-career.ts・delete-career.ts・get-career-for-edit.ts・list-careers.ts）を src/features/career/application/ に、組み立て用の関数と Server Action を src/features/career/server/queries.ts・actions.ts に作る。FR-001 の判定を src/shared/domain/organization.ts で行う
- [X] T067 [P] [US5] 職歴の入力を src/features/career/components/career-form.tsx に作る
- [X] T068 [US5] 管理画面のページを src/app/dash/careers/page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作り、src/proxy.ts に `/dash/careers/{uid}` の有無を足す
- [X] T069 [P] [US5] 学歴の型・Repository・D1 の実装・ユースケース・組み立て用の関数・Server Action・入力を src/features/education/ の domain/・application/・server/・components/ に作る
- [X] T070 [US5] 管理画面のページを src/app/dash/educations/page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作り、src/proxy.ts に `/dash/educations/{uid}` の有無を足す
- [X] T071 [US5] オーナーとして職歴と学歴を登録・編集・削除し、2 つのタブで同じ職歴を開いて後から保存した側が止まり入力が残ることを tests/e2e/career-and-education.spec.ts で確かめる（FR-042）

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T072 入力中の内容を `localStorage` に持ち、保存に成功したら消す部品を src/shared/components/draft-retention.tsx に作り、実績・職歴・学歴・組織・スキルの入力に使う。E2E で、保存せずに再読み込みしても入力が残ることを tests/e2e/draft-retention.spec.ts で確かめる（REQUIREMENTS.md の FR-14、research.md の R16）
- [ ] T073 本番の D1 にオーナーが個人の組織を登録した後、その行の id を src/shared/domain/organization.ts の定数に書き、個人の組織を消せないことを tests/workers/organization-edit.test.ts に足す（FR-041、research.md の R9）
- [ ] T074 オーナーとして実績を登録・編集・削除し、キーボードだけで同じ操作ができることを tests/e2e/project.spec.ts で確かめる（constitution V）
- [ ] T075 R2 の読み書きを src/shared/server/media-storage.ts に閉じ込め、実績・職歴の画像の追加と、実績の代表画像の選択と登録（その実績の画像だけ）を作る。画像の上限を plan.md に書いてから作る（constitution II）。**止める未決: U5**
- [ ] T076 秘匿化しない実績の画像を配る経路を作り、秘匿化した実績の画像が返らないことを結合で確かめる（FR-030）。**止める未決: U5**
- [ ] T077 本文の表示と、本文の中に画像とキャプションを置く入力を作る（FR-027）。**止める未決: U4**
- [X] T078 訪問者向けの実績の取り出しと識別子の有無（src/features/project/server/d1-project-repository.ts）を、秘匿化した組織名の無い組織を指す秘匿化した実績を出さない形にし、tests/workers/project-masking.test.ts と tests/integration/project-masking.test.ts で 404 と応答の中身を確かめる（U2 の決定、research.md の R5）。トリガの migration は足さない
- [ ] T079 docs/SOFTWARE_DESIGN.md の各デザインパターンの「手本のファイル」に、001 で最初に書いたファイル（Repository・DTO・組み立て用の関数・Dependency Injection・読む→計算→書く・ユースケース・失敗の表し方・見た目と操作を分ける）を書き、`bash .claude/skills/auditing-docs-convention/scripts/check.sh` を実行する
- [ ] T080 PR の CI が 10 分以内に収まることを GitHub Actions のステップの所要時間で確かめる（ADR-0019）
- [ ] T081 quickstart.md の手順をブランチの Preview で行う
- [ ] T082 問い合わせの場所のページ（別の spec）ができたら、秘匿化した実績の「非公開」の近くに、そのページへのリンクを src/features/project/components/visitor-project.tsx に足す（FR-021、plan.md の U7）。**止める依存: 問い合わせの場所のページ**

### サイトに載せるか（FR-044〜FR-046、2026-11-04 の決定）

- [X] T083 migration 0009 で `career.status`・`project.status`（既定 `draft`、CHECK）を足し、既定値と CHECK を tests/workers/migrations.test.ts で確かめる（FR-044）
- [X] T084 サイトに載せるかの値と読み方を src/shared/domain/site-status.ts に、入力を src/shared/components/site-status-field.tsx に作り、職歴・実績の型・フォーム・Repository・管理画面の一覧に足す。保存と既定を tests/workers/career-repository.test.ts・tests/workers/project-repository.test.ts・tests/unit/project-domain.test.ts・tests/e2e/career-and-education.spec.ts で確かめる（FR-007・FR-011・FR-044）
- [X] T085 訪問者向けの実績の取り出し（`findVisitorBySlug` と `hasSlug` の `VISITOR_VISIBLE`）を `published` だけにし、tests/workers/project-masking.test.ts と tests/integration/career-and-project-status.test.ts で、載せない実績の 404・応答の中身・切り替えた直後を確かめる。訪問者に出すことを前提にした既存の検査は、作り物の行を `published` で入れる（FR-014・FR-043・FR-045・SC-006）
- [X] T086 `SkillRepository.listWithPeriods` に読む実績（`all`・`published`）を選ぶ引数を足し、管理画面のスキルの一覧は `all` にする。tests/workers/skill-repository.test.ts と tests/unit/skill.test.ts で確かめる（FR-033）
- [ ] T087 訪問者がスキルと経験年数、職歴のスキルを見る画面ができたら、`listWithPeriods('published')` を使い、サイトに載せない実績の期間とスキルが出ないことを結合で確かめる（FR-033・FR-035）。**止める依存: 訪問者がスキルと経験年数を見る場所（spec の Assumptions）**

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → Phase 3 以降。T001 が満たされるまで、D1 を使う検査（tests/workers・tests/integration・tests/e2e）を回せない
- Phase 3（US1）は MVP。Phase 4（US2）は US1 の実績の実装に足す
- Phase 5（US3）・Phase 6（US4）・Phase 7（US5）は Phase 2 の後に並べられる。ただし T053 は T036 と T067 の入力を、T060 は T036 と T032 を使う
- Phase 8 は各 User Story の後

### User Story Dependencies

- US1: Phase 2 だけに依存
- US2: US1（T032・T035・T036）に依存
- US3: Phase 2 に依存。T048 は US1 の実績のページを使う
- US4: Phase 2 に依存。T060 は US1 に依存
- US5: Phase 2 に依存

### 未決が止めるタスク

| 未決 | 止めるタスク |
|---|---|
| U3 | T053 |
| U4 | T077。T035 の本文の表示 |
| U5 | T075・T076 |
| U6 の残り（端の扱い） | T055・T061 の、職歴の実績とスキルの部分 |
| U1・U8・U9 | 無し（U9 が覆れば構成のタスクを直す） |

### Within Each User Story

- 検査を先に書き、落ちることを確かめてから実装する
- domain → application → server → components → app の順

### Parallel Opportunities

- Phase 1: T004・T007・T009・T011 は別のファイル
- Phase 2: T015〜T018・T021・T022 は別のファイル
- 各 User Story の検査のタスク（[P]）は並べられる
- US3・US4・US5 は Phase 2 の後に並べられる

## Parallel Example: User Story 1

```text
T024 tests/unit/project-domain.test.ts
T025 tests/unit/project-usecases.test.ts
T026 tests/workers/project-repository.test.ts
T027 tests/integration/projects.test.ts
T028 tests/unit/proxy.test.ts
↓
T029 src/features/project/domain/project.ts
T030 src/features/project/domain/project-repository.ts
↓
T031 → T032 → T033 → T034、T035・T036 は並べる → T037・T038
```

## Implementation Strategy

### MVP First

1. Phase 1 で build を通す
2. Phase 2
3. Phase 3（US1）で、秘匿化しない実績を登録して `/projects/{slug}` で見る
4. Phase 4（US2）を足す。登録は既定で秘匿化され、US1 だけでは秘匿化した実績を実際の値で出しうるため、US2 を終えるまで main にマージしない

### Incremental Delivery

US1+US2 → US3 → US4 → US5 → Polish。各段階を Preview で確かめてからマージする

## Notes

- 機能どうしは import しない（ADR-0026）。機能をまたいで要る値は、各機能の Repository の実装が SQL で読む
- 書き込みの Server Action は、先頭でオーナーを確かめる。呼び忘れは型でも lint でも検出しない（ADR-0036 の Consequences）ため、結合の検査で各 Server Action を確かめる
- コミットはタスクか論理のまとまりごと
