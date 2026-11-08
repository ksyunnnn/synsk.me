---

description: "職務経歴書の実装タスク"
---

# Tasks: 職務経歴書

**Input**: `specs/002-resume/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md、001 の Phase 1・2（下の「001 への依存」）

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（書き込みの経路に、オーナー以外が通れないことの検査を書く）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US5）
- **止める未決: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない

## Contents

- 001 への依存
- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1（P1）
- Phase 4: User Story 2（P1）
- Phase 5: User Story 3（P1）
- Phase 6: User Story 4（P2）
- Phase 7: User Story 5（P2）
- Phase 7b: User Story 6（P2）
- Phase 8: Polish
- Dependencies & Execution Order
- Implementation Strategy

---

## 001 への依存

002 は 001 の次のものを変えずに使う（research.md の R2）。002 のタスクは、右の列の 001 のタスクが終わってから始める。

| 使うもの | 001 のタスク | 002 で待つタスク |
|---|---|---|
| `src/shared/server/env.ts`・`author.ts` | T002・T003（済み） | すべて |
| `src/shared/domain/period.ts` の期間の検証 | T015（済み） | T007 以降 |
| `src/shared/domain/action-result.ts`・`src/shared/components/field.tsx` | T022・T023（済み） | 管理画面のタスク |
| `src/app/dash/page.tsx` | T014（済み） | T012 |
| `src/proxy.ts` の `/projects/:slug` | T034 | T013・T031（同じファイルを直すため、001 の T034 の後に足す） |
| `tests/support/career-and-project-rows.ts` | T021（済み） | 写し元の行を入れる検査 |
| `src/shared/domain/period.ts` の経験年数の計算 | T061（001 の U6） | T047 |
| `src/shared/components/draft-retention.tsx` | T072 | T061 |
| 写し元の行を消すときに `resume_*` の `*_id` を NULL にする処理 | T032（実績）・T065（職歴）・T069（学歴） | T042・T043（元を消しても残ることの検査） |

---

## Phase 1: Setup

**Purpose**: 002 の検査と env の土台

- [X] T001 プロフィールのメールアドレスを渡す環境変数の型（`RESUME_EMAIL`）を src/shared/server/env.ts に足し、`.dev.vars.example` に雛形を足す。値はコードに書かない（research.md の R10）
- [X] T002 [P] workerd と結合の検査が、作り物の職務経歴書と写した行（`resume`・`resume_career`・`resume_project`・`resume_education`・`resume_project_skill`・`resume_skill_override`）を SQL で入れる関数と、消す関数を tests/support/resume-rows.ts に作る
- [X] T003 [P] tests/workers/migrations.test.ts に、0008 の後の `resume.audience` の既定値が `limited` であること、`resume_skill_override.months_override` があることを足す

---

## Phase 2: Foundational

**Purpose**: どの User Story も使う職務経歴書の型・識別子・Repository のインタフェース・管理画面の入口

- [X] T004 [P] 職務経歴書の型、`ResumeAudience`・`ResumeStatus` の `as const` の配列、識別子の決まり（uid の生成は `crypto.randomUUID()`、FR-002 の形の判定、限定公開用の書き換えを拒む、公開用の書き換えを許す）を src/features/resume/domain/resume.ts に作る（FR-001・FR-002・FR-037・FR-039）
- [X] T005 [P] T004 を tests/unit/resume-domain.test.ts で確かめる（uid の形、101 文字・大文字・記号を拒む、限定公開用の識別子の書き換えを拒む）
- [X] T006 [P] migrations/0010_drop_limited_token_hash_from_resume.sql で `resume` を作り直し、`limited_token_hash` を外す。限定公開用の URL は識別子（uid）だけで作る（FR-011・FR-012、research.md の R5）
- [X] T007 [P] T006 を tests/workers/migrations.test.ts で確かめる（`limited_token_hash` が無い、公開用は期限を持てない、索引 `resume_public` とトリガが残る）
- [X] T008 職務経歴書の Repository のインタフェース（写し元の読み出し・作成・一覧・編集用に id で読む・訪問者向けに読む・設定と状態と写した行の開いたときの更新日時つきの編集・削除・id と写した行の有無）を src/features/resume/domain/resume-repository.ts に作る
- [X] T009 [P] 職務経歴書の写した行の型（`ResumeCareer`・`ResumeProject`・`ResumeEducation`）を src/features/resume/domain/resume.ts に足す（data-model.md の「domain の型」）
- [X] T010 D1 の実装の骨組み（行の型と domain の型への詰め替え、id と写した行の有無）を src/features/resume/server/d1-resume-repository.ts に作る。行の型はこのファイルの中だけに置く（001 の research.md の R3）
- [X] T011 組み立て用の関数の骨組み（`hasResumeId`・`hasResumeRow`）を src/features/resume/server/queries.ts に作る
- [X] T012 src/app/dash/page.tsx に職務経歴書の一覧（`/dash/resumes`）へのリンクを足す
- [X] T013 src/proxy.ts の `DASH_ROW_EXISTS` に `resumes` を足し、`/dash/resumes/{uid}` と `/dash/resumes/{uid}/{careers,projects,educations}/{rowUid}` の有無で 404 の rewrite を足す。tests/unit/proxy.test.ts に確かめを足す（contracts/dash.md の共通）。001 の T034 の後に行う

**Checkpoint**: Phase 1 と 2 が終われば、User Story を始められる

---

## Phase 3: User Story 1 - 職歴と項目を選んで職務経歴書を作る (Priority: P1) 🎯 MVP

**Goal**: オーナーが職歴・実績・学歴を選んで限定公開用の職務経歴書を作り、管理画面で写した中身を見る

**Independent Test**: 作り物の職歴 2 件・実績 3 件・学歴 1 件を入れ、実績を 1 件外して限定公開用を作る。管理画面で職歴 2 件・実績 2 件・学歴 1 件が載り、外した実績が載らない

### Tests for User Story 1

- [X] T014 [P] [US1] 写し方（限定公開用は秘匿化した写し元も実際の組織名・題・本文・関連 URL を写す、選ばなかった行を写さない、実績のスキル名と上書きを写す、写し元の id を写す）を tests/unit/build-resume.test.ts で確かめる（FR-007・FR-008・FR-010・FR-025・FR-028）
- [X] T015 [P] [US1] 作成のユースケース（既定が限定公開用、識別子が uid、オーナーでない呼び出しを拒む、選んだ行が無ければ作らない）を、Repository の作り物の実装を渡して tests/unit/resume-usecases.test.ts で確かめる（FR-003・FR-011・FR-012・FR-033）
- [X] T016 [P] [US1] D1 の実装の作成（1 回の `batch()` で `resume` と写した行が入る、子の行の `resume_id` と `resume_project_id` が正しい、途中の文が失敗すると何も残らない、渡した識別子で入る、状態が `draft`、写した行が始まりの日の新しい順で読める）を tests/workers/resume-repository.test.ts で確かめる（FR-009・FR-012・FR-021、research.md の R4）
- [X] T017 [P] [US1] JWT のない `/dash/resumes` の GET が 403 で `no-store` を持つこと、JWT のない `createResume` が 403 の結果で D1 を変えないことを tests/integration/dash-resumes.test.ts で確かめる（FR-033）
- [X] T018 [P] [US1] オーナーとして `/dash/resumes/new` を開くと、登録したすべての職歴・実績・学歴が選ばれ、限定公開用が選ばれていること、実績を 1 件外して作ると設定の画面に載らないことを tests/e2e/resume-create.spec.ts で確かめる。キーボードだけで同じ操作ができる（FR-003・FR-005・SC-006、constitution V）

### Implementation for User Story 1

- [X] T019 [US1] 写し方を src/features/resume/domain/build-resume.ts に作る。限定公開用の分岐だけを書き、公開用は Phase 7（US5）の T067 で足すまで拒む（data-model.md の「写し方」）
- [X] T020 [US1] 写し元の読み出し（選んだ id の職歴・実績・学歴を、組織・スキル・上書きとともに 1 回の `batch()` で）、作成、一覧、編集用の読み出しを src/features/resume/server/d1-resume-repository.ts に足す（research.md の R4）
- [X] T021 [US1] ユースケースを src/features/resume/application/ に作る: create-resume.ts・list-resumes.ts・get-resume-for-edit.ts・list-resume-sources.ts。読む→計算→書くの順（docs/SOFTWARE_DESIGN.md）
- [X] T022 [US1] Server Action `createResume` を src/features/resume/server/actions.ts に作る。先頭でオーナーを確かめる。限定公開用は 303 で移さず、URL（`/resume/{slug}`）を結果に載せて同じ画面に返す（contracts/dash.md）
- [X] T023 [P] [US1] 作成の入力（題、限定公開用か公開用か、職歴・実績・学歴のチェックボックスをすべて選んだ状態で）を src/features/resume/components/resume-create-form.tsx に作る。公開用の選択肢は Phase 7（US5）の T068 で足すまで出さない
- [X] T024 [P] [US1] 設定の画面の中身（写した職歴・実績・学歴・スキルの一覧）を src/features/resume/components/resume-overview.tsx に作る
- [X] T025 [US1] 管理画面のページを src/app/dash/resumes/page.tsx・new/page.tsx・[id]/page.tsx・[id]/missing/page.tsx に作る。各ページは描画の前にオーナーを確かめる

**Checkpoint**: User Story 1 が単独で動く

---

## Phase 4: User Story 2 - 限定公開用を提出先に渡す (Priority: P1)

**Goal**: URL を知る人が、公開中で期限の前の限定公開用を読み、ブラウザの印刷機能で PDF に保存する。条件に合わなければ中身を返さない

**Independent Test**: 秘匿化した作り物の実績を載せた限定公開用を公開し、ログインせずに URL を開いて実際の題と組織名が出ること。識別子が違う・出し直す前・期限切れ・非公開の URL が 404

### Tests for User Story 2

- [X] T026 [P] [US2] 訪問者向けの取り出し（識別子が合い、公開中で期限の前か期限が無いときだけ返す、非公開・期限切れ・違う識別子・公開用の識別子で返さない）を tests/workers/resume-repository.test.ts で確かめる（FR-011・FR-013・FR-014・FR-022・FR-023、research.md の R6）
- [X] T027 [P] [US2] tests/unit/proxy.test.ts に、条件に合わない `/resume/{slug}` を `/resume/{slug}/missing` へ rewrite すること、`/resume/{slug}` とその下の経路のすべての応答（200・404・判定できないとき）に `Cache-Control: no-store, must-revalidate`・`X-Robots-Tag: noindex`・`Referrer-Policy: no-referrer` を付けることを足す（FR-015、research.md の R7）
- [X] T028 [P] [US2] 限定公開用の 4 つの状態の応答が 404 で写した値を含まないこと、200 の応答に秘匿化した写し元の実際の題・組織名・本文が出ること、すべての応答が 3 つのヘッダを持つこと、期限を過ぎた後に期限を延ばすと同じ URL が 200 になること、JWT のない `changeResumeStatus`・`editResumeSettings` が D1 を変えないことを tests/integration/resume-limited.test.ts で確かめる（SC-003・SC-004・SC-005・FR-010・FR-033、User Story 2 の 1〜6）

### Implementation for User Story 2

- [X] T029 [US2] 訪問者向けの取り出しを src/features/resume/server/d1-resume-repository.ts に足す。条件をすべて WHERE に入れ、行が返ったときだけ写した行を読み、contracts/visitor-resume.md の DTO に詰める
- [X] T030 [US2] ユースケース get-visitor-resume.ts・change-resume-status.ts・edit-resume-settings.ts（題と期限。限定公開用の識別子の書き換えを拒む）を src/features/resume/application/ に作り、組み立て用の関数（`hasVisitorResume`）を src/features/resume/server/queries.ts に、Server Action `changeResumeStatus`・`editResumeSettings` を src/features/resume/server/actions.ts に足す。どれも research.md の R8 の楽観ロックを付ける
- [X] T031 [US2] src/proxy.ts の matcher に `/resume/:path*` を足し、`hasVisitorResume` で 404 の rewrite と、`/resume/{slug}` とその下の経路のヘッダを足す（research.md の R7）
- [X] T032 [P] [US2] 訪問者向けの職務経歴書の表示（職歴・実績・学歴・スキルの名前。秘匿化しない形だけ）を src/features/resume/components/visitor-resume.tsx に作る。本文は U4 が解けるまで出さない
- [X] T033 [US2] 訪問者のページを src/app/resume/[slug]/page.tsx と src/app/resume/[slug]/missing/page.tsx（`notFound()` だけ）に作る。`generateMetadata` は職務経歴書の中身を使わない（ADR-0024）
- [X] T034 [US2] 設定の画面に、状態の切り替えと題の入力を足す（src/features/resume/components/resume-settings-form.tsx）。限定公開用の識別子を読み取りだけで出す（FR-037）
- [X] T035 [US2] 期限の入力（日時か、期限なし）を、作成の入力（src/features/resume/components/resume-create-form.tsx）と設定の入力（resume-settings-form.tsx）に足す（FR-013）。**止める未決: U9**
- [X] T036 [US2] プロフィールの定数を src/features/resume/domain/profile.ts に置き、src/shared/server/env.ts からメールアドレスを読んで DTO に足し、visitor-resume.tsx に出す。メールアドレスが欠ければ出さない（FR-034〜FR-036、research.md の R10）。メールアドレスを訪問者に出すのは **止める未決: U8**
- [X] T037 [US2] 写した本文を visitor-resume.tsx に出す（FR-010）。**止める未決: U4**
- [X] T038 [P] [US2] 印刷用の CSS（`@media print`。ボタンとページの外へのリンクを載せない）を src/app/globals.css に足し、「PDF で保存」のボタン（`window.print()` を呼ぶ）を src/features/resume/components/print-button.tsx に作る（FR-029・FR-030、research.md の R11）
- [X] T039 [US2] visitor-resume.tsx にボタンを置き、限定公開用のページの応答がボタンを持つことを tests/integration/resume-limited.test.ts で確かめる（FR-029）
- [X] T079 [P] [US2] URL の出し直し（新しい uid を渡す、オーナーでない呼び出しを拒む）を tests/unit/resume-usecases.test.ts で、D1 の書き換え（識別子が変わり古い識別子で読めない、公開用と無い id は書かない、楽観ロック、重なる識別子を拒む）を tests/workers/resume-edit.test.ts で、設定の画面の URL と出し直した後の古い URL の 404・新しい URL の 200・JWT のない呼び出しが D1 を変えないことを tests/integration/resume-limited.test.ts で、設定の画面に URL が出て出し直せることを tests/e2e/resume-limited.spec.ts で確かめる（FR-040・FR-033・FR-038）
- [X] T080 [US2] URL の出し直しを、Repository の `regenerateLimitedSlug`（src/features/resume/server/d1-resume-repository.ts）、ユースケース src/features/resume/application/regenerate-resume-url.ts、Server Action `regenerateResumeUrl`、設定の画面の URL の表示と「URL を出し直す」（src/features/resume/components/resume-url-form.tsx）に作る（FR-040、research.md の R5）
- [X] T040 [US2] ブラウザで印刷の見た目（ボタンが載らない、日本語が読める）を `npx -y @playwright/cli@latest` の PDF の出力で確かめる（FR-029）

**Checkpoint**: User Story 1 と 2 が単独で動く

---

## Phase 5: User Story 3 - 元を直しても、渡した職務経歴書は変わらない (Priority: P1)

**Goal**: 元の職歴・実績・学歴・組織・スキルを直す・消しても、職務経歴書の中身が変わらない

**Independent Test**: 職務経歴書を作ったあと、元の実績の題と組織名を直し、元の学歴を 1 件消す。職務経歴書のページで作ったときの題・組織名・学歴が出る

### Tests for User Story 3

- [X] T041 [P] [US3] 元の実績の題・組織名・スキルの上書きを SQL で直した後、限定公開用のページの応答が作ったときの値を出すことを tests/integration/resume-snapshot.test.ts で確かめる（FR-007・SC-001、User Story 3 の 1・2・4）
- [X] T042 [US3] 元の学歴・実績・職歴を 001 の削除の Server Action（オーナーとして呼ぶ）で消した後も、写した行が残り、ページに出ることを tests/integration/resume-snapshot.test.ts に足す（Edge Cases、User Story 3 の 3）。001 の T032・T065・T069 の後に行う
- [X] T043 [P] [US3] 元のスキル名を直しても写した `resume_project_skill.skill_name` と `resume_skill_override` が変わらないことを tests/workers/resume-repository.test.ts に足す（FR-025・FR-028）

### Implementation for User Story 3

- [X] T044 [US3] スキルの一覧（写したスキルの名前を 1 つにまとめる）を src/features/resume/domain/resume-skills.ts に作り、DTO の `skills` を埋める（FR-026）。**止める未決: U11**
- [X] T045 [P] [US3] T044 を tests/unit/resume-skills.test.ts で確かめる。**止める未決: U11**
- [X] T046 [P] [US3] 経験年数（写した実績の期間から求め、写した上書きがあればそれを使う。求める日は要求の日）を tests/unit/resume-skills.test.ts で確かめる（FR-027・FR-028）
- [X] T047 [US3] src/features/resume/domain/resume-skills.ts で src/shared/domain/period.ts の経験年数の計算を呼び、visitor-resume.tsx に年と月で出す。001 の T061 の後に行う

**Checkpoint**: User Story 1〜3 が単独で動く

---

## Phase 6: User Story 4 - 職務経歴書ごとに中身を直す (Priority: P2)

**Goal**: 作った職務経歴書の中で写した値を直し、その職務経歴書にだけ効く。削除と、訪問者に見せたときの見た目の確認もここで作る

**Independent Test**: 職務経歴書の中で職歴の組織名と実績の本文を直し、その職務経歴書に直した値が出ること、元の組織名と実績の本文が変わらないこと

### Tests for User Story 4

- [X] T048 [P] [US4] 写した行の編集（直した値がその職務経歴書にだけ効く、ほかの職務経歴書と元の行が変わらない、写した実績の始まりの日を直すと並びが変わる、開いたときの更新日時が違えば何も書かない、スキル名と上書きの入れ直し）と削除の順序を tests/workers/resume-edit.test.ts で確かめる（FR-031・FR-032・FR-038、User Story 4 の 1・2、research.md の R8・R9）
- [X] T049 [P] [US4] 写した行の編集のユースケース（項目の不備、オーナーでない呼び出しを拒む、秘匿化するかどうかの入力を受け取らない）を tests/unit/resume-usecases.test.ts に足す（FR-031・FR-033）
- [X] T050 [P] [US4] JWT のない `editResumeCareer`・`editResumeProject`・`editResumeEducation`・`editResumeSkillOverrides`・`deleteResume` が D1 を変えないことを tests/integration/dash-resumes.test.ts に足す（FR-033）
- [X] T051 [P] [US4] オーナーとして写した行を直して設定の画面に出ること、2 つのタブで同じ職務経歴書を開き後から保存した側が止まり入力が残ること、削除の確認を経て一覧から消えることを tests/e2e/resume-edit.spec.ts で確かめる（FR-038、REQUIREMENTS.md の FR-11）

### Implementation for User Story 4

- [X] T052 [US4] 写した行の編集（職歴・実績・学歴・上書き）と削除を src/features/resume/server/d1-resume-repository.ts に足す。編集は research.md の R8、削除は R9 の順で 1 つの `batch()`
- [X] T053 [US4] ユースケース edit-resume-career.ts・edit-resume-project.ts・edit-resume-education.ts・edit-resume-skill-overrides.ts・delete-resume.ts を src/features/resume/application/ に、Server Action を src/features/resume/server/actions.ts に足す。上書きは年と月で受け取り、月数で保存する
- [X] T054 [P] [US4] 写した職歴の入力を src/features/resume/components/resume-career-form.tsx に作る（組織名・肩書・期間・本文・関連 URL）
- [X] T055 [P] [US4] 写した実績の入力を src/features/resume/components/resume-project-form.tsx に作る（組織名・種類・題・期間・本文・関連 URL・スキルの名前）
- [X] T056 [P] [US4] 写した学歴の入力を src/features/resume/components/resume-education-form.tsx に作る（学校・学部・期間・備考）
- [X] T057 [P] [US4] 上書きの入力（スキルごとに年と月、または空）を src/features/resume/components/resume-skill-overrides-form.tsx に作る
- [X] T058 [US4] 管理画面のページを src/app/dash/resumes/[id]/careers/[rowId]/page.tsx・projects/[rowId]/page.tsx・educations/[rowId]/page.tsx（それぞれ missing/page.tsx も）・[id]/skills/page.tsx・[id]/delete/page.tsx に作る
- [X] T059 [US4] 訪問者に見せたときの見た目の画面を src/app/dash/resumes/[id]/preview/page.tsx に作る。訪問者向けと同じ DTO と visitor-resume.tsx で描き、状態・期限に関わらず出す（REQUIREMENTS.md の FR-13）
- [X] T060 [P] [US4] オーナーとして見た目の画面が非公開の職務経歴書でも出ることを tests/e2e/resume-edit.spec.ts に足す（REQUIREMENTS.md の FR-13）
- [ ] T061 [US4] 写した行の編集の画面に、入力中の内容を保持する部品（src/shared/components/draft-retention.tsx）を使い、保存せずに再読み込みしても入力が残ることを tests/e2e/resume-edit.spec.ts に足す（REQUIREMENTS.md の FR-14）。001 の T072 の後に行う

**Checkpoint**: User Story 1〜4 が単独で動く

---

## Phase 7: User Story 5 - 公開用をサイトで見せる (Priority: P2)

**Goal**: 公開用を 1 つ作り、訪問者が `/resume/{slug}` で読み、ブラウザの印刷機能で PDF に保存する。秘匿化した職歴・実績は秘匿化した値で出し、隠す値を応答に含めない

**Independent Test**: 秘匿化した実績と秘匿化しない実績を 1 件ずつ載せた公開用を公開し、応答に秘匿化した実績の実際の題・組織名・本文が無いこと、秘匿化しない実績が実際の値で出ること

秘匿化した行は、migration 0008 の `resume_career.is_masked`・`resume_project.is_masked` で見分ける（plan.md の U2）。

### Tests for User Story 5

- [ ] T062 [P] [US5] 公開用の写し方（秘匿化しない行は実際の値、秘匿化した行は秘匿化した組織名と題で `description`・`url` を写さない、秘匿化した組織名が無ければ作らない、サイトに載せない行は写さない）を tests/unit/build-resume.test.ts に足す（FR-008・FR-016・SC-007、research.md の R4）
- [ ] T063 [P] [US5] 2 つ目の公開用を保存の前に拒むこと、公開用の識別子を書き換えられること、訪問者向けの取り出しが秘匿化した行の `description`・`url` を返さないことを tests/workers/resume-public.test.ts で確かめる（FR-019・FR-039・FR-017）
- [ ] T064 [P] [US5] 公開用のページの HTML と RSC の応答（`<title>`・OGP を含む）に、秘匿化した写し元の実際の組織名・題・本文・画像・関連 URL が 0 件であること、オーナーが職務経歴書の中で秘匿化した行に本文を書き足しても出ないこと、秘匿化しない行が実際の値で出ること、非公開の公開用が 404 であることを tests/integration/resume-public.test.ts で確かめる（SC-002・FR-017・FR-018・FR-022・FR-031、User Story 5 の 1〜4）
- [ ] T065 [P] [US5] 公開用のページの応答が「PDF で保存」のボタンを持ち、印刷するページに T064 の値が 0 件であることを tests/integration/resume-public.test.ts に足す（User Story 5 の 5）

### Implementation for User Story 5

- [X] T066 [US5] migration 0008 の `resume_career.is_masked`・`resume_project.is_masked` の既定値が 1 であることを tests/workers/migrations.test.ts で確かめる
- [ ] T067 [US5] src/features/resume/domain/build-resume.ts に公開用の分岐を足し、サイトに載せない写し元を写さない（FR-016）。そのために `readSources` が写し元の `status` を返すようにする。src/features/resume/server/d1-resume-repository.ts の訪問者向けの取り出しを、秘匿化した行で `description`・`url` を SELECT しない形にする（contracts/visitor-resume.md）
- [ ] T068 [US5] src/features/resume/components/resume-create-form.tsx に公開用の選択肢を出し、公開用を選んだときは、サイトに載せない職歴・実績を選択肢から外す（FR-005）。create-resume.ts で 2 つ目の公開用と、サイトに載せない職歴・実績を選んだ公開用を、保存の前に拒む（FR-016・FR-019）。edit-resume-settings.ts と resume-settings-form.tsx で公開用の識別子を書き換えられるようにする（FR-039）
- [ ] T069 [US5] src/features/resume/components/visitor-resume.tsx に秘匿化した行の表示を足し、公開用も src/app/resume/[slug]/page.tsx で読む（識別子は限定公開用と公開用で重ならない）。`/resume/{slug}` に付く限定公開用のヘッダ（research.md の R7）を公開用で外すかを決める。`generateMetadata` は DTO の値だけを使う
- [ ] T070 [US5] 秘匿化した行の本文の場所に「非公開」と出す見た目を visitor-resume.tsx に作る（FR-017、plan.md の U5）。contact へのリンクは T077 で足す
- [ ] T071 [US5] 公開用のページに「PDF で保存」のボタンを置く（FR-029）

---

## Phase 7b: User Story 6 - 作ったあとに職歴・実績・学歴を足す (Priority: P2)

**Goal**: 作った職務経歴書に、設定の画面から元の職歴・実績・学歴を選んで足す。写し方は作成と同じ（FR-041）

**Independent Test**: 0 件の職務経歴書に、設定の画面から職歴・実績・学歴を足すと、写した行と直すリンクが出る。足したあとに元を直しても、職務経歴書の値は変わらない

### Tests for User Story 6

- [X] T081 [P] [US6] 足すユースケース（作成と同じ写し方とスキル・上書き、何も選ばない・形の違う id・消えた元の行・写し済みの行を足さない、先に書き換えられていたら `conflict`、オーナーでない呼び出しを拒む）を tests/unit/resume-usecases.test.ts に、足す画面の経路で行の有無を見ないことを tests/unit/proxy.test.ts に足す（FR-033・FR-038・FR-041）
- [X] T082 [P] [US6] D1 の書き込み（写した行とスキルが足した実績につく、既にある行は変わらない、上書きは同じ名前が無いものだけ入る、楽観ロック、無い id）を tests/workers/resume-edit.test.ts に足す（FR-041、research.md の R14）
- [X] T083 [P] [US6] JWT のない足す画面の GET が 403、`addResumeRows` が D1 を変えないこと、作り手が足すと元の値で写り設定の画面へ 303 で移り、写した行が選択肢に出ないことを tests/integration/dash-resumes.test.ts に足す（FR-033・FR-041）
- [X] T084 [P] [US6] 0 件の職務経歴書に設定の画面から職歴・実績・学歴を足すと写した行と直すリンクが出ること、足したあとに元を直しても値が変わらないことを tests/e2e/resume-add.spec.ts で確かめる（FR-041）

### Implementation for User Story 6

- [X] T085 [US6] Repository の `addRows`（作成と同じ写した行の文を楽観ロックの後に置く）を src/features/resume/server/d1-resume-repository.ts に、ユースケース src/features/resume/application/add-resume-rows.ts、Server Action `addResumeRows` を src/features/resume/server/actions.ts に足す（research.md の R14）
- [X] T086 [US6] 作成の画面の選択の部品を src/features/resume/components/resume-source-fieldset.tsx に移し、足す画面（src/features/resume/components/resume-add-rows.tsx・resume-add-rows-form.tsx、src/app/dash/resumes/[id]/{careers,projects,educations}/new/page.tsx）と設定の画面の各見出しの下のリンク（resume-overview.tsx）を足す。src/proxy.ts で足す画面の経路の行の有無を見ない

公開用に足すことは、公開用の写し方（T067）が入るまで `build-resume.ts` が拒む。

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T072 本番の応答で、職務経歴書のページのメールアドレスが Email Address Obfuscation で難読化されるかを確かめ、結果を plan.md の U8 に書く。難読化されなければ、別の方法が決まるまでメールアドレスを出さない（FR-035、research.md の R10）。**止める未決: U8**
- [ ] T073 ブランチの Preview で、限定公開用のページを Chrome と Safari の印刷の画面から PDF に保存し、日本語が読めることを確かめる（FR-029）
- [ ] T074 PR の CI が 10 分以内に収まることを GitHub Actions のステップの所要時間で確かめる（ADR-0019）
- [ ] T075 quickstart.md の手順をブランチの Preview で行う
- [ ] T076 `bash .claude/skills/auditing-docs-convention/scripts/check.sh` を実行し、出力が無いことを確かめる
- [ ] T077 contact のページができたら、T070 の「非公開」の横に contact へのリンクを足す（FR-017、plan.md の U5）
- [X] T078 限定公開用の作成の選択肢に、サイトに載せない職歴・実績も出て写せることを tests/workers/resume-repository.test.ts で確かめる（FR-005・FR-010）。作成の選択肢と写し方は `status` を読まない形のまま変えない

---

## Dependencies & Execution Order

### Phase Dependencies

- 001 の Phase 1・2 → Phase 1 → Phase 2 → Phase 3 以降
- T013 と T031 は src/proxy.ts を直すため、001 の T034 の後に行う
- Phase 3（US1）は MVP。Phase 4（US2）は US1 の作成に足す
- Phase 5（US3）は US2 の訪問者のページを使う。T042 は 001 の削除のタスクを、T047 は 001 の T061 を待つ
- Phase 6（US4）は US1 の後に、US2・US3 と並べられる。T059 は US2 の visitor-resume.tsx を使う
- Phase 7（US5）は US1・US2 の後
- Phase 7b（US6）は US1 と US4（T052）の後
- Phase 8 は各 User Story の後

### User Story Dependencies

- US1: Phase 2 だけに依存
- US2: US1（T020・T021）に依存
- US3: US2（T029・T032・T033）に依存
- US4: US1 に依存。T059 は US2 の T032 に依存
- US5: US1・US2 に依存
- US6: US1 に依存。楽観ロックは US4 の T052 と同じ形

### 未決が止めるタスク

| 未決 | 止めるタスク |
|---|---|
| U4 | T037。T032 の本文の表示 |
| U8 | T036 のメールアドレス・T072 |
| U9 | T035 |
| U11 | T044・T045 |
| U10 | T033 の 404 の画面の文言と `<title>`。404 の状態コードは止めない |
| U1・U12・U13・U14 | 無し |

### Within Each User Story

- 検査を先に書き、落ちることを確かめてから実装する
- domain → application → server → components → app の順

### Parallel Opportunities

- Phase 1: T002・T003 は別のファイル
- Phase 2: T004〜T007・T009 は別のファイル
- 各 User Story の検査のタスク（[P]）は並べられる
- US4 は US1 の後に US2・US3 と並べられる

## Parallel Example: User Story 1

```text
T014 tests/unit/build-resume.test.ts
T015 tests/unit/resume-usecases.test.ts
T016 tests/workers/resume-repository.test.ts
T017 tests/integration/dash-resumes.test.ts
T018 tests/e2e/resume-create.spec.ts
↓
T019 src/features/resume/domain/build-resume.ts
↓
T020 → T021 → T022、T023・T024 は並べる → T025
```

## Implementation Strategy

### MVP First

1. Phase 1・2
2. Phase 3（US1）で、限定公開用を作って管理画面で見る
3. Phase 4（US2）を足す。PDF はブラウザの印刷機能で作る（research.md の R11）
4. Phase 5（US3）で、元を直しても変わらないことを確かめる。US1〜US3 を終えるまで main にマージしない（公開中の限定公開用が、写した値で出ることを確かめてから出す）

### Incremental Delivery

US1+US2+US3 → US4 → US6 → US5 → Polish。各段階を Preview で確かめてからマージする

## Notes

- 機能どうしは import しない（ADR-0026）。写し元の値は src/features/resume/server/d1-resume-repository.ts が SQL で読む
- 書き込みの Server Action は、先頭でオーナーを確かめる。呼び忘れは型でも lint でも検出しない（ADR-0036 の Consequences）ため、結合の検査で各 Server Action を確かめる
- コミットはタスクか論理のまとまりごと
