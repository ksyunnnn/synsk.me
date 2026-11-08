# Implementation Plan: 外部 activity の取得

**Branch**: `feature/210-external-activity` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-external-activity/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 要件と検査の対応
- 未決
- Project Structure
- Complexity Tracking

## Summary

Cron Triggers が 1 時間に 1 回、1 つの取得元から一覧を取り、取得元の応答をその場で `FetchedItem` に詰め替え、値が変わった項目だけを `activity` に書く。取得の成否は `fetch_result` に取得元ごとに残し、失敗した取得元の activity は書き換えない。取り直した一覧に無い activity は、URL が 404・410 を返したと確かめたときだけ、1 回 5 件まで消す。オーナーは管理画面（`/dash/activities`）で、一覧を取れない取得元の activity を URL を指名して、または手で入力して登録・削除し、`/dash/life-events` で life event を作る。訪問者は `/life-events/{slug}` で life event の個別のページを開く。外部の activity を一覧に並べるのは 005 が持つ。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components・Server Actions）、React 19.3、`jose`、Tailwind CSS 4。新しい依存は足さない（RSS は小さな関数で読む。research.md の R4）

**Storage**: Cloudflare D1（binding `DB`）。`migrations/0004`・`0007`・`0009` の表に、`0020_add_uid_to_activity.sql`（`activity.uid`）と `0021_insert_activity_sources.sql`（外部の取得元の行）を足す（research.md の R1）

**Testing**: Vitest（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（結合）、Playwright（E2E）。ADR-0019 の 4 段階。取得元の応答は固定した値を返す関数で差し替え、検査は外部のサービスを叩かない

**Target Platform**: Cloudflare Workers。取得は Cron Triggers の `scheduled()`（[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)）

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: `/life-events/{slug}` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）

**Constraints**: 外への要求の量と回数の上限は research.md の R6。D1 の 1 日の書き込みは上限の 3% に収める。`/dash` の応答は `no-store`。PR の CI は 10 分以内

**Scale/Scope**: 一覧を取る取得元 7 つ、URL を指名する取得元 4 つ、手で入力する取得元 2 つ。管理画面 2 種類、訪問者のページ 1 種類

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 書き込みの Server Action は先頭でオーナーを確かめ、オーナーでない呼び出しが何も書かないことを結合で確かめる（contracts/dash.md）。取得の処理は Worker の `scheduled()` からだけ呼ばれ、HTTP の経路を持たない。認証情報は secret に置き、D1 と応答に出さない |
| II. Stop on Missing Input | 通る | 外への要求の上限の値を research.md の R6 に書いた。日付・題を取れない登録は保存しない（R9）。connpass の API キーが無ければ取らない |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。life event の画像（FR-028〜FR-030）は 003 の仕組みに依存するため、この plan では範囲から外し tasks.md に未チェックで残す（R11） |
| IV. Partial Availability | 通る | 取得元ごとの失敗を `{ ok: false }` で返し、前回の activity を残す（R8）。1 回に 1 枠だけ取るため、1 つの失敗がほかの取得元を止めない |
| V. Accessible Controls | 通る | 入力はネイティブの要素と `<form>`。001 の `src/shared/components/field.tsx` を使う。E2E でキーボードだけの操作を確かめる |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加を含めない |
| VII. Boundary Translation | 通る | 取得元の応答は `src/features/activity/server/sources/` の関数の中で `FetchedItem` に詰め替える（R4） |
| VIII. Portable Core | 通る | D1 は `src/features/activity/server/d1-*-repository.ts`、外への `fetch` は `server/sources/` と `server/scheduled.ts`、`cloudflare:workers` の env は `src/shared/server/env.ts`、Cron Triggers は `worker/index.ts` だけで使う |
| IX. Simplicity | 通る | `server/sources/rss.ts` の使い手は Zenn・Medium・Speaker Deck。`server/sources/oembed.ts` の使い手は X・Spotify・YouTube。Repository のインタフェースは単体の検査の作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2） |
| Test Layering | 通る | 同じことを 2 つの段階で確かめない（下の表の「段階」） |
| Display Speed | 通る | `/life-events/{slug}` は NFR-03〜NFR-07 の対象。判定はフィールドの計測 |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。404 と 403 は `src/proxy.ts` が決め、`tests/unit/proxy.test.ts` が確かめる |
| Allowlist Visibility | 通る | 訪問者向けの DTO が出す項目を列挙する（contracts/visitor-life-event.md） |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001・FR-002・FR-003 | 取得元の行と分類 | W（0021 の行） |
| FR-004 | 取り込み方と認証情報がコードと secret にある | スキーマが持つ（`activity_source` が列を持たない） |
| FR-005 | 登録していないサイトの URL で 1 行にする | W |
| FR-006・FR-007・SC-001 | 取得元の応答を詰め替え、同じ項目を 2 行にしない | 単（詰め替え）・W（書き込み） |
| FR-008 | ID で・URL で同じ項目を判定する | W |
| FR-009・FR-010・FR-011 | URL を指名して題を取る、手で入力する、日付の無い登録を拒む | 単（ユースケース）・E（手で入力） |
| FR-012・SC-005 | 取り直しても登録した日付を書き換えない | 単（ユースケース）・W（SQL） |
| FR-013 | 初めて取り込んだ日時が取り直しで変わらない | W |
| FR-014・FR-015・SC-002 | 失敗した取得元の activity を残し、失敗を記録する | 単 |
| FR-016 | 取得の結果と `last_succeeded_at` の保持 | W |
| FR-017・FR-020・SC-003 | 404・410 で消し、判定できなければ残す | 単 |
| FR-018・SC-004 | 件数が決まっている取得元で、一覧に無いだけの古いものを消さない | 単 |
| FR-019 | 消す件数の上限 | 単 |
| FR-021・FR-022 | 一覧を取る activity を管理画面で書き換え・削除できない | 単 |
| FR-023・FR-024・FR-025 | life event の作成・書き換え・削除、題と起きた日の必須、リンク先の入力が無い | 単（決まり）・W（保存）・E（画面） |
| FR-026 | 状態の列を持たない | スキーマが持つ |
| FR-027・SC-006 | life event の削除で `media` が残らない | W |
| FR-028・FR-029・FR-030 | life event の画像 | R11 が解けてから |
| FR-031 | オーナーでない呼び出しが何も書かない | 結 |
| FR-032 | 取得の処理が life event を書き換えない | W |
| FR-033 | URL を指名した・手で入力した activity の削除 | 単（判定）・W（削除）・E |
| FR-034・SC-007 | life event の識別子の URL で 200、無い識別子で 404 | 結・単（proxy） |
| FR-035 | 作ったときの識別子が uid、形と重複を拒む | 単（決まり）・W（重複） |

## 未決

この plan では決めない項目と、実装者が置いた既定。既定はオーナーが PR で覆せる。

| ID | 項目 | 置いた既定 | 根拠 | 止める範囲 |
|---|---|---|---|---|
| U1 | 取得の結果をオーナーに見せる画面を持つか | 既定（実装者、2026-11-09）: `/dash/activities` に表で出す | research.md の R13 | 無し |
| U2 | 取得を走らせる時機 | 既定（実装者、2026-11-09）: 1 時間に 1 回、1 回に 1 枠。各取得元は 8 時間に 1 回 | research.md の R6 | 無し |
| U3 | 外部の activity の代表の画像の出し方 | 既定（実装者、2026-11-09）: 取得元が返す URL を保存するだけにし、出し方は一覧の spec（005）が持つ | 004 は外部の activity を訪問者に出す画面を持たない | 無し |
| U4 | life event の題を必ず入れるか | 既定（実装者、2026-11-09）: 必ず入れる | research.md の R10 | 無し |
| U5 | life event の説明の書式と、説明の中に画像を置けるか | 既定（実装者、2026-11-09）: 書式を持たない文章、空行で段落、画像を置かない | research.md の R10 | 無し |
| U6 | life event の個別のページに出す値と見せ方 | 既定（実装者、2026-11-09）: `/life-events/{slug}` に題・起きた日・説明 | research.md の R10 | 無し |
| U7 | 取得元が題を返さない URL を指名したときの扱い | 既定（実装者、2026-11-09）: 保存せず、理由を示す | research.md の R9 | 無し |
| U8 | 取得元の分類を変える手順 | 既定（実装者、2026-11-09）: migration で書き換える | research.md の R14 | 無し |
| U9 | 取得元で消えたと判定する条件・404 の扱い・行を消すか・消す件数の上限 | 既定（実装者、2026-11-09）: 一覧に無い候補の URL が 404・410 なら行を消す。1 回 5 件まで | research.md の R7 | 無し |
| U10 | life event の画像（003 の仕組み） | 依存: #209 の画像の仕組みができてから作る | research.md の R11 | FR-028〜FR-030、User Story 5 の 4・5 |
| U11 | URL を指名する取得元の日付と、登録していないサイトの取り込み方 | 既定（実装者、2026-11-09）: URL を指名する取得元はすべてオーナーが日付を入れる。登録していないサイトは手で入力する。日付は日本時間の 0 時 | research.md の R9 | 無し |
| U12 | life event の URL のコレクション名 | 既定（実装者、2026-11-09）: `life-events` | research.md の R10 | 無し |

## Project Structure

### Documentation (this feature)

```text
specs/004-external-activity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dash.md
│   ├── fetch.md
│   └── visitor-life-event.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

ADR-0026 のディレクトリの形と依存の向きに従う。機能どうしは import しない。

```text
migrations/
├── 0020_add_uid_to_activity.sql
└── 0021_insert_activity_sources.sql
worker/index.ts                        scheduled() を足す
wrangler.jsonc                         triggers.crons を足す
src/
├── proxy.ts                           /life-events/:slug と /dash/activities・/dash/life-events を足す
├── app/
│   ├── life-events/[slug]/page.tsx    life event の個別のページ（訪問者）
│   ├── life-events/[slug]/missing/page.tsx
│   └── dash/
│       ├── page.tsx                   入口に 2 つ足す
│       ├── activities/   page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx
│       └── life-events/  同じ
├── features/activity/
│   ├── domain/        source.ts（取得元と取り込み方）、fetched-item.ts、gone.ts（候補と上限）、activity.ts、life-event.ts、各 Repository のインタフェース
│   ├── application/   refresh-source.ts、refresh-registered.ts、run-scheduled-fetch.ts、register-activity.ts、edit-activity.ts、delete-activity.ts、life event のユースケース
│   ├── components/    activity-form.tsx、life-event-form.tsx、visitor-life-event.tsx
│   └── server/        d1-activity-repository.ts、d1-life-event-repository.ts、queries.ts、actions.ts、scheduled.ts、sources/
└── shared/server/env.ts               ActivityEnv（GITHUB_TOKEN・QIITA_ACCESS_TOKEN・CONNPASS_API_KEY）

tests/
├── unit/          取得元の詰め替え、gone、ユースケース、life event の決まり、proxy
├── workers/       activity と life event の Repository の実装、migration 0020・0021
├── integration/   /life-events/{slug}、/dash/activities・/dash/life-events
├── e2e/           オーナーの操作
└── support/       activity-rows.ts（D1 に作り物の行を入れる道具）
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。`activity` の機能の `server/` が組み立て用の関数（`queries.ts`）と Server Action（`actions.ts`）と取得の入口（`scheduled.ts`）を持ち、`page.tsx`・`src/proxy.ts`・`worker/index.ts` はそれを呼ぶ（ADR-0030）。

## Complexity Tracking

constitution に反するものは無い。
