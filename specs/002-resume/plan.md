# Implementation Plan: 職務経歴書

**Branch**: `feature/72-rebuild` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-resume/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 要件と検査の対応
- 未決
- Project Structure
- Complexity Tracking

## Summary

オーナーが管理画面（`/dash/resumes`）で、職歴・実績・学歴を選んで職務経歴書を作る。作るときに、選んだ行とスキルを、限定公開用か公開用かに応じた値で `resume_*` の表へ写し、1 回の `batch()` で書く。訪問者は公開用と限定公開用を `/resume/{slug}` で読み、ページの「PDF で保存」のボタンでブラウザの印刷機能を開いて PDF に保存する。限定公開用の識別子はランダムな uid で、URL に識別子のほかの値を持たない（R5）。サーバーは PDF を作らない（research.md の R11）。

001 のオーナーの判定・env・期間・入力の部品・Server Action の結果の型・proxy をそのまま使う（[research.md](./research.md) の R2）。写した職歴・実績が作ったときに秘匿化していたかは、migration 0008 の `resume_career.is_masked`・`resume_project.is_masked` が持つ（U2）。決め方は research.md が持つ。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components・Server Actions・Route Handlers）、React 19.3、`jose`（001 のオーナーの判定）、Tailwind CSS 4。PDF はブラウザの印刷機能（`@media print` の CSS と `window.print()`。package も binding も足さない。research.md の R11）

**Storage**: Cloudflare D1（binding `DB`）。スキーマは `migrations/0001`〜`0008`（research.md の R1）と、写し元の `career.status`・`project.status` を足す `0009`

**Testing**: Vitest 4.1.11（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（本番ビルドに対する結合）、Playwright（E2E、Chromium）。ADR-0019 の 4 段階

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: 訪問者が到達する `/resume/{slug}` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）

**Constraints**: 応答は NFR-08・NFR-09 を満たす。限定公開用と `/dash` の応答は `no-store`。PR の CI は 10 分以内

**Scale/Scope**: 書き手はオーナー 1 人。管理画面は職務経歴書の一覧・作成・設定・写した行 3 種類の足す画面と編集・上書きの編集・見た目の確認・削除。訪問者の経路は公開用・限定公開用のページの 2 つ

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 条件付きで通る | 限定公開用は、識別子が合い期限の前で公開中のときだけ写した行を読む（R6）。公開用で秘匿化した行の `description`・`url` を写さず読まない（R4、[contracts/visitor-resume.md](./contracts/visitor-resume.md)）。秘匿化した行は `is_masked` で見分ける（U2）。書き込みの Server Action は先頭でオーナーを確かめ、オーナーでない呼び出しが何も書かないことを結合で確かめる（[contracts/dash.md](./contracts/dash.md)） |
| II. Stop on Missing Input | 条件付きで通る | 公開用に写す秘匿化した組織名が欠ければ作らない（R4）。費用のかかる処理を持たない（PDF は訪問者のブラウザが作る。R11） |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。U が止める要件は、解けるまで範囲に入れない |
| IV. Partial Availability | 通る | ページの取得元は D1 の 1 つと、コードのプロフィールと環境変数のメールアドレス。メールアドレスが欠けてもほかを出す（R10） |
| V. Accessible Controls | 通る | 入力はネイティブの要素と `<form>`。作成の画面の選択はチェックボックス。E2E でキーボードだけの操作を確かめる |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加・非正規化を含めない。経験年数は保存せずに毎回求める（FR-027） |
| VII. Boundary Translation | 通る | D1 の行は Repository の実装の中で domain の型に詰め替える |
| VIII. Portable Core | 通る | D1 は `src/features/resume/server/d1-resume-repository.ts`、env は `src/shared/server/env.ts` だけで使う |
| IX. Simplicity | 通る | `shared/` に新しく置くものは無い。Repository のインタフェースは、単体の検査で渡す作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2）。PDF の package を足さない（R11） |
| Test Layering | 通る | 同じことを 2 つの段階で確かめない（下の表の「段階」） |
| Display Speed | 通る | 2 つのページは NFR-03〜NFR-07 の対象。判定はフィールドの計測 |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。404 と 403 は `src/proxy.ts` が決め、`tests/unit/proxy.test.ts` が確かめる。限定公開用は `no-store`（R7） |
| Allowlist Visibility | 通る | 訪問者向けの DTO が出す項目を列挙する（contracts/visitor-resume.md） |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001・FR-002 | 複数作れる。識別子の形と重複を拒む | 単（形）・W（重複） |
| FR-003・FR-004 | 既定は限定公開用。作った後に変えられない | E（既定）・W（トリガ） |
| FR-005・SC-006 | 作成の画面がすべてを選んで始まる | E |
| FR-005・FR-010 のサイトに載せない写し元 | 限定公開用の作成の選択肢に載せない職歴・実績も出て、写せる | W |
| FR-005・FR-016・SC-007 のサイトに載せない写し元 | 公開用の選択肢に出さず、選んでも写さない | 単（`build-resume.ts`）・E（選択肢）。US5 で足す |
| FR-006・FR-034・FR-036 | プロフィールを写さず、定数の値が出る | 結 |
| FR-035 | メールアドレスのスパム対策 | 本番で確かめる（U8） |
| FR-007・FR-025・FR-028・SC-001 | 元を直す・消しても、写した値が変わらない（ページ） | 結 |
| FR-008・FR-010・FR-016 | 写し方（限定公開用・公開用の秘匿化しない・秘匿化した） | 単（`build-resume.ts`） |
| FR-009 | 始まりの日の新しい順 | W |
| FR-011・FR-012・FR-023・SC-003 | 4 つの状態で中身を返さない。識別子はランダムな uid | 単（uid）・W（取り出し）・結（応答） |
| FR-013・FR-014・SC-004 | 期限なし・期限切れ・延ばした後に同じ URL で読める | 結 |
| FR-015・SC-005 | `no-store`・`noindex`・`no-referrer` | 単（proxy）・結（応答） |
| FR-017・FR-018・SC-002 | 公開用の応答に秘匿化した行の隠す値が無い | 結（ページ。PDF は同じページを印刷する） |
| FR-019 | 2 つ目の公開用を保存の前に拒む | W |
| FR-020 | 公開用は期限を持たない | スキーマが持つ（CHECK） |
| FR-021・FR-022 | 作ると非公開。非公開は中身を返さない | 結（SC-003 と同じ検査） |
| FR-024 | 学歴が職務経歴書に出る | 結 |
| FR-026・FR-027 | スキルの一覧と経験年数 | 単（名前の比べ方は U11 が解けるまで仮の形） |
| FR-029・FR-030 | ページに「PDF で保存」のボタンと印刷用の CSS があり、印刷するのは同じページ | 結（ボタン）・手（ブラウザで PDF に保存する） |
| FR-031・FR-032 | 写した値を直すと、その職務経歴書にだけ効く | W |
| FR-033 | オーナーでない呼び出しが何も書かない | 結 |
| FR-037・FR-039 | 限定公開用の識別子は uid で書き換えを拒む。公開用は既定で uid、書き換えられる | 単 |
| FR-040 | 設定の画面に URL が出る。出し直すと識別子が新しい uid になり、古い URL は 404、新しい URL は 200 | 単（ユースケース）・W（書き換え）・結（応答）・E |
| FR-038 | 先に書き換えられていたら保存しない | W（判定）・E（入力が残ること） |
| FR-041 | 作ったあとに足すと、作成と同じ写し方で写り、元を直しても変わらない。写し済みの元の行は選択肢に出ない。消えた元の行と写し済みの行は足さない。上書きが既にある名前は変えない。楽観ロック | 単（ユースケース）・W（書き込み）・結（403 と 303）・E |
| REQUIREMENTS.md の FR-11・FR-13・FR-14 | 削除の順序、見た目の確認の画面、入力中の内容の保持 | W・E・E（001 の T072 の部品） |

## 未決

この plan では決めない。止めるタスクは tasks.md が `[U<n>]` で示す。

| ID | 未決 | 決める人・場所 | 止める範囲 |
|---|---|---|---|
| U1 | D1 の表から TypeScript の型を作る方法（#188） | #188 | 無し（001 の U1 と同じ） |
| U2 | 決定済み（2026-11-04）。migration 0008 の `resume_career.is_masked`・`resume_project.is_masked`（既定 1）で見分ける | — | 無し |
| U3 | 決定済み（2026-11-04）。001 の FR-033 と同じ数え方で、`src/shared/domain/period.ts` の `countExperienceMonths` を使う | — | 無し |
| U4 | 本文の書式と本文の画像（001 の U4・U5、spec の「写した本文の中の画像を、写し元を削除したあとにどう扱うか」） | オーナー | 写した本文の表示 |
| U5 | 決定済み（2026-11-04、001 の U7 と同じ）。本文の場所に「非公開」と出し、contact へ案内する導線を置く。contact のページができるまではリンクを置かない（spec の FR-017） | — | 無し。contact のページができたらリンクを足す（tasks.md の T077） |
| U6 | 決定済み（2026-11-04）。項目は氏名・自己紹介・メールアドレス。氏名と自己紹介は `src/features/resume/domain/profile.ts` の定数、メールアドレスは環境変数 `RESUME_EMAIL`（R10）。値はオーナーが入れる | — | 無し |
| U7 | 決定済み（2026-11-04）。ブラウザの印刷機能で PDF にする（R11）。サーバーで PDF を作る形に変えるときに、要求の上限の値を決める | — | 無し |
| U8 | メールアドレスのスパム対策。Email Address Obfuscation は Worker が加えた HTML に効かないと公式に書かれている（research.md の R10）。本番で確かめ、効かなければ方法を決める | オーナー（実装のときに確かめる） | メールアドレスを訪問者に出すこと |
| U9 | 期限の既定の値・期限を選ぶ画面の形・入力した日時の時刻帯（spec の「決定が無く」） | オーナー | 期限の入力の部品。期限の保存と判定は止めない |
| U10 | 中身を返さないときの画面と、職務経歴書の題を訪問者に出すか（spec の「決定が無く」） | オーナー | 404 の画面の文言、ページの `<title>` |
| U11 | スキルの「同じ名前」の比べ方（大文字と小文字を区別するか。research.md の R12） | オーナー | スキルの一覧（FR-026） |
| U12 | 職歴・実績・学歴を 1 件も選ばずに作れるか（spec の「決定が無く」） | オーナー | 無し。決まるまで 1 件も選ばない作成を拒まない |
| U13 | 決定済み（2026-11-08）。設定の画面で URL をいつでも示し、出し直せる（spec の FR-040、R5） | — | 無し |
| U14 | ADR-0048 の「職務経歴書の slug は題から候補を提示し、オーナーが確定させる」と、spec の FR-037・FR-039 の食い違い | オーナー（決定の記録） | 無し。plan は spec に従う |

依存（未決ではない）: 001 の部品（research.md の R2）。経験年数の計算は 001 の T061 が `src/shared/domain/period.ts` に書く。入力中の内容の保持は 001 の T072 の部品を使う。`src/proxy.ts` は 001 の作業者も直すため、002 の変更は 001 の T034 の後に足す。

## Project Structure

### Documentation (this feature)

```text
specs/002-resume/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── visitor-resume.md
│   └── dash.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

ADR-0026 のディレクトリの形と依存の向きに従う。機能どうしは import しない。

```text
src/
├── proxy.ts                         /resume/* の 404 とヘッダ、/dash/resumes/* の 404 を足す
├── app/
│   ├── resume/[slug]/page.tsx       限定公開用と公開用（訪問者）
│   ├── resume/[slug]/missing/page.tsx
│   └── dash/
│       ├── page.tsx                 職務経歴書の一覧へのリンクを足す
│       └── resumes/
│           page.tsx・new/page.tsx・[id]/page.tsx・[id]/preview/page.tsx・[id]/skills/page.tsx・
│           [id]/delete/page.tsx・[id]/missing/page.tsx・
│           [id]/{careers,projects,educations}/[rowId]/page.tsx・…/[rowId]/missing/page.tsx・
│           [id]/{careers,projects,educations}/new/page.tsx
├── features/
│   └── resume/
│       ├── domain/       resume.ts・build-resume.ts・resume-skills.ts・profile.ts・resume-repository.ts
│       ├── application/  create-resume.ts・add-resume-rows.ts・edit-resume-*.ts・change-resume-status.ts・regenerate-resume-url.ts・delete-resume.ts・
│       │                 get-visitor-resume.ts・get-resume-for-edit.ts・list-resumes.ts
│       ├── components/   visitor-resume.tsx・print-button.tsx・各入力の部品
│       └── server/       d1-resume-repository.ts・queries.ts・actions.ts
└── shared/
    └── server/env.ts                メールアドレスの環境変数の型を足す

tests/
├── unit/          resume の domain と application・proxy
├── workers/       resume の Repository の実装（本物の migrations/ を当てる）
├── integration/   /resume/* と /dash/resumes の応答
├── e2e/           オーナーの操作
└── support/       career-and-project-rows.ts（001）、resume-rows.ts
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。`src/features/resume/server/` が組み立て用の関数（`queries.ts`）と Server Action（`actions.ts`）を持ち、`page.tsx`・`src/proxy.ts` はそれを呼ぶ（ADR-0030・ADR-0040）。

## Complexity Tracking

constitution に反するものは無い。
