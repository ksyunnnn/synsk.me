# Implementation Plan: 一覧

**Branch**: `feature/211-feed` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-feed/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 要件と検査の対応
- 未決
- Project Structure
- Complexity Tracking

## Summary

ビュー `activity_feed`（`migrations/0025_create_activity_feed.sql`）が、外部の activity・life event・公開の note・サイトに載せる実績と職歴を UNION ALL でつなぎ、秘匿化した実績と職歴は秘匿化した値だけを列に出す。転載先と一致する外部の activity はビューが除く。`src/features/activity/` の Repository がこのビューだけを読み、`(sort_key, type_rank, item_id)` で並べて 1 ページ 50 件を DTO に詰める。訪問者は `/timeline` で一覧を読む。トップ（`/`）は変えない。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components）、React 19.3、Tailwind CSS 4。新しい依存は足さない

**Storage**: Cloudflare D1（binding `DB`）。表を足さず、ビュー `activity_feed` を `0025` で作る（research.md の R1）。#209 の `0015` と #210 の `0020`・`0021` を前提とする

**Testing**: Vitest（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（結合）、Playwright（E2E）。ADR-0019 の 4 段階

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: `/timeline` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）。1 回の読み取りのスキャン行数を workerd の検査で測る（research.md の R13）

**Constraints**: 1 ページ 50 件、ページの番号は 1,000 まで（research.md の R7）。応答は `no-store`。PR の CI は 10 分以内

**Scale/Scope**: 訪問者のページ 1 種類。ビュー 1 つ。管理画面を持たない

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 秘匿化した実績と職歴の実際の値・本文・関連 URL・画像を、ビューが列に持たない（research.md の R5、data-model.md）。下書きと削除した note、サイトに載せない実績と職歴、学歴をビューが出さない。書き込みの経路を足さない |
| II. Stop on Missing Input | 通る | 費用のかかる処理と外への発信を持たない。読み取りの量は 1 ページ 50 件・1,000 ページまで（R7） |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。職歴のスキルは #208 の後に回し、範囲から外す（R11） |
| IV. Partial Availability | 通る | 題の無い外部の activity も 1 件として出す（R9）。一覧は 1 つのビューを 1 回読み、D1 の失敗は 500 にする（R12） |
| V. Accessible Controls | 通る | 操作できる部品はネイティブの `<a>` だけ。E2E でキーボードだけでリンクを辿る |
| VI. Measure Before Optimizing | 通る | 索引・写しを足さない。スキャン行数を測って research.md に書く（R13） |
| VII. Boundary Translation | 通る | 外部のサービスとやりとりしない |
| VIII. Portable Core | 通る | D1 は `src/features/activity/server/d1-feed-repository.ts` だけで使う。ビューは migration が持つ |
| IX. Simplicity | 通る | `FeedRepository` のインタフェースは、単体の検査の作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2）。種類ごとのカードの部品を分けない |
| Test Layering | 通る | 出す条件と秘匿化は workerd、HTML に出ないことと `no-store` は結合、キーボードの操作は E2E で確かめる。同じことを 2 つの段階で確かめない |
| Display Speed | 通る | `/timeline` は NFR-03〜NFR-07 の対象。代表画像と埋め込みを読まない（R9・R10） |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。データで決まる 404 は無い |
| Allowlist Visibility | 通る | ビューが列を列挙し、Repository が DTO の項目を列挙する（contracts/visitor-feed.md） |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001・SC-005 | 学歴が並ばない | W |
| FR-002 | 外部の activity が並ぶ | W |
| FR-003 | life event が並ぶ | W |
| FR-004・SC-006 | サイトに載せない実績と職歴が並ばない | W |
| FR-005・SC-002 | 下書き・削除・下書きに戻した note が並ばない | W |
| FR-006 | 公開した版の題と説明文で並ぶ | W |
| FR-007・FR-008・FR-009 | 種類ごとの並びの日付（note は作成日、実績は始まりの日） | W |
| FR-010・SC-004 | 5 種類を混ぜ、同じ日付の組を含むデータで、手で並べた順と一致し、2 回読んで同じ | W |
| FR-011 | 同じ日の life event が外部の activity より後に並ぶ。日本時間で日を分ける | W |
| FR-012・FR-013・SC-001 | 秘匿化した実績と職歴の行に実際の値・本文・URL が無い | W（ビューの列）・結（HTML） |
| FR-014・FR-021 | 秘匿化しない実績と職歴が実際の値で並び、組織名を直すと直した名前になる | W |
| FR-015 | 訪問者の一覧がビューだけを読む | W（Repository の実装） |
| FR-016・FR-017・SC-003 | 転載先と一致する外部の activity を除き、note が並ばなければ除かない | W |
| FR-018・FR-019 | 種類と取得元・分類を持つ | 単（詰め替え） |
| FR-020 | 外部の activity が取得元の URL へリンクする | E |
| NFR-02 | 0 件・範囲の外のページの画面 | 結 |
| NFR-09 | `/timeline` が `no-store` | 結（`cache-candidates.test.ts`） |

## 未決

この plan では決めない項目と、実装者が置いた既定。既定はオーナーが PR で覆せる。

| ID | 項目 | 置いた既定 | 根拠 | 止める範囲 |
|---|---|---|---|---|
| U1 | 並びの日付が同じとき、どの種類を先に並べるか | 既定（実装者、2026-11-09）: note・外部の activity・life event・実績・職歴の順 | research.md の R4 | 無し |
| U2 | 暦の日付と日時が同じ日のときの順と、日の境目の時刻帯 | 既定（実装者、2026-11-09）: 暦の日付をその日の日時より古く並べる。日の境目は日本時間 | research.md の R4 | 無し |
| U3 | 一覧から note と実績の個別のページへリンクするか | 既定（実装者、2026-11-09）: リンクする | research.md の R9 | 無し |
| U4 | 一覧に代表画像を出すか。外部の activity の代表の画像の出し方 | 既定（実装者、2026-11-09）: 出さない | research.md の R10 | 無し |
| U5 | 転載先の URL と外部の activity の URL が一致するとみなす条件 | 既定（実装者、2026-11-09）: 文字列が完全に一致するとき | research.md の R6 | 無し |
| U6 | 一覧を見せる画面の名前と URL | 既定（実装者、2026-11-09）: 「timeline」、`/timeline`。トップは変えない | research.md の R8 | 無し |
| U7 | ページ送りの仕方 | 既定（実装者、2026-11-09）: 1 ページ 50 件、`?page=N`、1,000 ページまで | research.md の R7 | 無し |
| U8 | 一覧に並べる値 | 既定（実装者、2026-11-09）: contracts/visitor-feed.md の DTO。実績と職歴の本文は出さず、秘匿化したものだけ「非公開」と出す | research.md の R9 | 無し |
| U9 | 職歴のスキル | 依存: #208 のマージの後に決める | research.md の R11 | 職歴の行のスキル |
| U10 | 埋め込みの分類の見せ方 | 既定（実装者、2026-11-09）: 埋め込みを読み込まず、取得元へのリンクで出す | research.md の R9 | 無し |

## Project Structure

### Documentation (this feature)

```text
specs/005-feed/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── visitor-feed.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

ADR-0026 のディレクトリの形と依存の向きに従う。機能どうしは import しない。

```text
migrations/
└── 0025_create_activity_feed.sql
src/
├── app/timeline/page.tsx                 一覧（訪問者）
└── features/activity/
    ├── domain/        feed.ts（DTO、ページの番号、行からの詰め替え）、feed-repository.ts
    ├── application/   list-feed.ts
    ├── components/    feed.tsx
    └── server/        d1-feed-repository.ts、queries.ts（listFeed を足す）、deps.ts（feed を足す）

tests/
├── unit/          feed.test.ts（ページの番号、詰め替え）
├── workers/       feed-repository.test.ts、migrations.test.ts（0025）
├── integration/   feed.test.ts
├── e2e/           feed.spec.ts
└── support/       既存の activity-rows.ts・note-rows.ts・career-and-project-rows.ts を使う
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。一覧は ADR-0027 の「timeline は `activity/` の中の部品にする」により `activity` の機能に置き、`server/queries.ts` の組み立て用の関数を `page.tsx` が呼ぶ（ADR-0030）。

## Complexity Tracking

constitution に反するものは無い。
