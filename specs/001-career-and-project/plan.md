# Implementation Plan: 職歴と実績

**Branch**: `feature/72-rebuild` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-career-and-project/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 要件と検査の対応
- 未決
- Project Structure
- Complexity Tracking

## Summary

オーナーが管理画面（`/dash`）で組織・職歴・実績・学歴・スキルを登録・編集・削除し、訪問者はサイトに載せる実績を `/projects/{slug}` の個別のページで見る。サイトに載せない職歴・実績は、訪問者向けの取り出しが読まない。秘匿化した実績は、Repository の実装が出してよい列だけを読んで DTO に詰め、実際の題・組織名・本文・関連 URL・画像を応答に含めない。オーナーの判定は Cloudflare Access と、アプリケーションの中での Access の JWT の検証（ADR-0013・ADR-0036）。D1 へは ORM を使わずに読み書きする（ADR-0035）。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components・Server Actions・Cache Components）、React 19.3、`jose`（JWT の検証）、Tailwind CSS 4。headless のライブラリは未決（U3）

**Storage**: Cloudflare D1（binding `DB`）。スキーマは `migrations/0001`〜`0007` と `0008_rebuild_career_project_and_resume.sql`（research.md の R1）と `0009_add_status_to_career_and_project.sql`（`career.status`・`project.status`）。画像は R2（binding `NOTE_IMAGES`）

**Testing**: Vitest 4.1.11（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（本番ビルドに対する結合）、Playwright（E2E、Chromium）。ADR-0019 の 4 段階

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: 訪問者が到達する `/projects/{slug}` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）

**Constraints**: 応答は NFR-08・NFR-09 を満たす。`/dash` の応答は `no-store`。PR の CI は 10 分以内

**Scale/Scope**: 書き手はオーナー 1 人。管理画面は 5 種類の行（職歴・実績・学歴・スキル・組織）、訪問者のページは実績の個別のページ 1 種類

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 秘匿化した実績で隠す列を SELECT しない（R5、[contracts/visitor-project.md](./contracts/visitor-project.md)）。書き込みの経路（Server Action）は先頭でオーナーを確かめ、オーナーでない呼び出しが何も書かないことを結合で確かめる（R4、[contracts/dash.md](./contracts/dash.md)） |
| II. Stop on Missing Input | 条件付きで通る | 保存は訪問者に出す操作で、秘匿化に要る秘匿化した組織名が欠ければ保存しない（FR-001）。費用のかかる処理は画像の追加だけで、量の上限の値が未決（U5）。値が決まるまで画像の追加を作らない |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。001 の中で検査を対応させられない訪問者側の職歴の要件は 001 の範囲から外し、005 で確かめる（R15、U9） |
| IV. Partial Availability | 通る | 実績のページの取得元は D1 の 1 つで、1 回の `batch()` で読む。画面は NFR-02 の状態（データが無い＝404、読み込み中、エラー＝500 の画面）で成立する。一部欠損に当たる取得元の分かれは無い |
| V. Accessible Controls | 通る | 入力はネイティブの要素と `<form>`。組織名の選択肢の部品は headless のライブラリに任せる（U3）。E2E でキーボードだけの操作を確かめる |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加・非正規化を含めない（R12） |
| VII. Boundary Translation | 通る | JWT の中身は `src/shared/server/author.ts` の中で `Author` に詰め替える。D1 の行は Repository の実装の中で domain の型に詰め替える（R3） |
| VIII. Portable Core | 通る | D1 は各機能の `server/*-repository.ts` と `src/shared/server/organization-repository.ts`、R2 は `src/shared/server/media-storage.ts`、`cloudflare:workers` の env は `src/shared/server/env.ts` だけで使う |
| IX. Simplicity | 通る | `shared/` に置くものは 2 つ目の使い手を名前で挙げた（R4・R9・R10・R14・R16）。Repository のインタフェースは、単体の検査で D1 の代わりに渡す作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2） |
| Test Layering | 通る | 同じことを 2 つの段階で確かめない（下の表の「段階」） |
| Display Speed | 通る | 実績のページは NFR-03〜NFR-07 の対象。判定はフィールドの計測で、CI では判定しない（ADR-0019） |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。404 と 403 は `src/proxy.ts` が決め、`tests/unit/proxy.test.ts` が確かめる |
| Allowlist Visibility | 通る | 訪問者向けの DTO が出す項目を列挙する（contracts/visitor-project.md） |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001 | 秘匿化した組織名の無い組織を指す秘匿化した職歴・実績を保存しない。指されている組織の秘匿化した組織名を空にできない | 単（判定）・W（保存） |
| FR-002 | 組織名を入力すると登録した組織名が選択肢に出る | E（U3 が解けてから） |
| FR-003 | 同じ組織名で 2 つ目を作れない | W |
| FR-004 | 組織名を直すと実績のページの組織名が変わる | 結 |
| FR-005 | 秘匿化した組織名は組織の 1 列 | スキーマが持つ（data-model.md） |
| FR-006・FR-041 | 指されている組織と個人の組織を消せない | W |
| FR-007・FR-008・FR-036・FR-038・FR-039 | 登録・編集・削除と、終わりの日が空・前後の逆の扱い | W・E |
| FR-009・FR-020、FR-021・FR-022・FR-030 の職歴の部分 | 001 の範囲から外す。005 の User Story 2 で確かめる（R15） | — |
| FR-010・FR-015 | 秘匿化を指定せずに保存すると秘匿化される | W |
| FR-011・FR-012・FR-016・FR-018 | 実績の登録・編集・削除。種類の 4 値 | W・E |
| FR-013 | 登録の識別子が uid、秘匿化した実績の識別子を書き換えられない、秘匿化に切り替えると新しい uid、重複を拒む | 単（決まり）・W（重複） |
| FR-014・SC-002 | サイトに載せる実績の識別子の URL で 200、無い識別子と載せない実績の識別子で 404 | 結・単（proxy） |
| FR-017・FR-035 | 職歴の実績とスキルの求め方 | 単（U6 の残り、端の扱いが解けてから） |
| FR-019・FR-021・FR-022・FR-026・FR-030 の実績の部分・SC-001 | 秘匿化した実績のページの HTML と RSC の応答に隠す値が無い | 結 |
| FR-023 | 秘匿化しない実績のページに実際の値 | 結 |
| FR-024・FR-029 | 列が無い | スキーマが持つ |
| FR-027・FR-028 | 本文の画像と代表画像 | U4・U5 が解けてから |
| FR-031 | 大文字と小文字だけ違う名前を拒む | W |
| FR-032 | 実績にスキルを 0 個以上つなぐ | W |
| FR-033・FR-034・SC-004 | 経験年数の計算と上書き | 単 |
| FR-033 のサイトと管理画面の分け方 | サイトは載せる実績の期間だけ、管理画面はすべての実績の期間を読む | W（`listWithPeriods`）・単（管理画面が `all`） |
| FR-037・SC-005 | 学歴が実績のページの応答に含まれない | 結 |
| FR-040 | オーナーでない呼び出しが何も書かない | 結 |
| FR-042 | 先に書き換えられていたら保存しない | W（判定）・E（入力が残ること） |
| FR-043 | 秘匿化するかとサイトに載せるかを切り替えた直後の要求で新しい状態 | 結 |
| FR-044 | サイトに載せるかを指定せずに保存すると載せない。入力に出し、保存して読める | 単（読み方）・W（列の既定と保存）・E（職歴の入力） |
| FR-045・SC-006 | サイトに載せない実績のページの HTML と RSC の応答が 404 で、職歴・実績の値が訪問者の経路に無い | W・結 |
| FR-046 | 載せるかと秘匿化するかを別々に持ち、載せる実績を秘匿化するかで出し分ける | W・結（FR-019・FR-023 と同じ検査に載せる行を使う） |
| SC-003 | 組織名を直した直後の実績のページ | 結（FR-004 と同じ検査） |

## 未決

この plan では決めない。止めるタスクは tasks.md が `[U<n>]` で示す。

| ID | 未決 | 決める人・場所 | 止める範囲 |
|---|---|---|---|
| U1 | D1 の表から TypeScript の型を作る方法（#188） | #188 | 無し。どちらでも差し替える場所を 2 か所に限る（R3） |
| U2 | 秘匿化した組織名の無い組織を秘匿化した職歴・実績が指すことを、DB のトリガでも止めるか。決定済み（2026-11-04、オーナー）: アプリケーションだけで止め、トリガは足さない。訪問者に出すときは、秘匿化した組織名の無い組織を指す秘匿化した行を出さない（research.md の R5） | オーナー | 無し |
| U3 | headless のライブラリ（ネイティブの `<datalist>` で足りるかを含む） | オーナー（決定の記録） | 組織名の入力の部品（FR-002） |
| U4 | 本文の書式 | オーナー | 本文の表示、本文の中の画像とキャプション（FR-027） |
| U5 | 画像の形式と大きさの上限、画像を配る経路（003 と共有） | オーナー（003 と合わせる） | 画像の追加・代表画像・画像の配信（FR-027・FR-028・FR-030 の秘匿化しない側） |
| U6 | 経験年数の数え方は決定済み（2026-11-04、オーナー。spec の FR-033、research.md の R13）。職歴と実績の期間が端の日だけ接するときに重なるとみなすか（FR-017・FR-035）は、この決定に含まれず未決 | オーナー | 職歴の実績とスキル（FR-017・FR-035）だけ |
| U7 | 伏せた見た目の本文の形。決定済み（2026-11-04、オーナー。spec の FR-021）: 本文の場所に「非公開」と出し、問い合わせの場所への導線を置く。導線は問い合わせの場所のページ（別の spec）ができてから足す | オーナー（デザイン） | 無し。導線のリンクは問い合わせの場所ができるまで置かない（tasks.md の T082） |
| U8 | `docs/REQUIREMENTS.md` の FR-13（公開前に見た目を確かめる）が、サイトに載せない（`draft`）状態を持つ職歴・実績に当たるか | オーナー | 無し。当たると決まればタスクを足す |
| U9 | 機能の名前に `education`・`skill`・`organization` を足すこと（R10）。訪問者側の職歴の要件を 005 に回すこと（R15）は決定済み（2026-11-04、オーナー: 職歴は一覧の中で見せるだけで、職歴の一覧のページを持たない） | オーナー | 確認だけ。覆れば構成のタスクを直す |

依存（未決ではない）: D1 を使う検査は、`migrations/0008`・`0009` を当てた D1 で回す（R1）。個人の組織の id の定数は、本番にその組織を登録した後に書く（R9）。

## Project Structure

### Documentation (this feature)

```text
specs/001-career-and-project/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── visitor-project.md
│   └── dash.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

ADR-0026 のディレクトリの形と依存の向きに従う。機能どうしは import しない。

```text
src/
├── proxy.ts                         作り直す。/projects/:slug の 404、/dash の 403 と no-store
├── app/
│   ├── projects/[slug]/page.tsx     実績の個別のページ（訪問者）
│   ├── projects/[slug]/missing/page.tsx
│   └── dash/
│       ├── page.tsx
│       ├── forbidden/page.tsx       既存
│       ├── projects/  careers/  educations/  skills/  organizations/
│       │   各 page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx
├── features/
│   ├── project/   domain/ application/ components/ server/
│   ├── career/    domain/ application/ components/ server/
│   ├── education/ domain/ application/ components/ server/
│   ├── skill/     domain/ application/ components/ server/
│   └── organization/ application/ components/ server/   組織の編集の画面
└── shared/
    ├── domain/period.ts             期間・重なり・経験年数（skill・career・002）
    ├── domain/organization.ts       組織の決まりと個人の組織の定数（career・project・organization・002）
    ├── server/env.ts                cloudflare:workers の env を読む
    ├── server/author.ts             Access の JWT の検証（001 の各管理画面・002・003）
    ├── server/organization-repository.ts
    ├── server/media-storage.ts      R2（U5 が解けてから）
    └── components/                  headless の上の部品（U3）、入力中の内容の保持（R16）

tests/
├── unit/          proxy・author・各機能の domain と application・period
├── workers/       各 Repository の実装（本物の migrations/ を当てる）
├── integration/   /projects/{slug}・/dash の応答
├── e2e/           オーナーの操作
└── support/       access.ts（既存）、D1 に作り物の行を入れる道具
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。各機能の `server/` が組み立て用の関数（`queries.ts`）と Server Action（`actions.ts`）を持ち、`page.tsx` と `src/proxy.ts` はそれを呼ぶ（ADR-0030・ADR-0040）。

## Complexity Tracking

constitution に反するものは無い。
