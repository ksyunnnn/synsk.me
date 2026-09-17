# Implementation Plan: note を書いて公開し、読む

**Branch**: `feature/note-write-and-read` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-note-write-and-read/spec.md`

## Summary

作り手が `/dash` で note を作り、保存し、公開し、書き換え、削除する。訪問者は `/notes/{slug}` で公開された note を読む。

- データは D1 の2つの表に持つ。書き換えている内容（`note`）と、訪問者に見せている内容（`note_publication`）。ORM は使わない（[research.md](./research.md) の R1）
- `/dash` は Cloudflare Access とアプリケーションの中の JWT の検証の2段で守る（R2）
- 訪問者の画面も作り手の画面もキャッシュに載せず、要求のたびに D1 から描画する（R3）
- 書き込みは JavaScript なしで動くフォームと Server Action で作る（R4、R5）
- `/dash` 配下を、デプロイ時のキャッシュ判定の対象から外す（R7）

## Technical Context

**Language/Version**: TypeScript 6.0、Node.js 22 以上（ビルドとテスト）、Cloudflare Workers（実行）

**Primary Dependencies**: Next.js 16.3（API）を vinext 1.0.0-beta.9 で Workers に載せる。React 19.2。足す依存は `jose`（JWT の検証）と `server-only`

**Storage**: Cloudflare D1（binding `DB`、データベース `synsk-me`）。スキーマはリポジトリ直下の `migrations/`

**Testing**: Vitest 4.1.11（単体、`@cloudflare/vitest-plugin` による workerd）、`createTestHarness()`（結合）、Playwright（E2E、Chromium）、`scripts/verify-deploy.mjs`（配信後）

**Target Platform**: Cloudflare Workers。本番 `https://synsk.me`、ブランチごとのプレビュー URL

**Project Type**: Web アプリケーション（1つの Next.js の中に画面とサーバを持つ）

**Performance Goals**: 訪問者が到達する `/notes/{slug}` は `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 の閾値を満たす。キャッシュに載せるかは計測してから決める（R3）

**Constraints**:
- D1 Free: 1回の Worker 呼び出しで50クエリ、書き込み1日10万行、1行 2 MB
- 題200文字、本文100,000文字、slug 100文字（[data-model.md](./data-model.md)）
- 1回の操作で D1 に送るクエリは2本以下
- すべての画面と操作が JavaScript なしで動く

**Scale/Scope**: 作り手1人。note は数十〜数百件を想定する

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則・制約 | 判定 | この plan での満たし方 |
|---|---|---|
| I. Protected Values | 通る | 下書きの題と本文は、訪問者向けの取り出しが SELECT しない（R1）。書き込みの経路は Access と JWT の検証の2段で守り、作り手以外が通れないことを結合テストと配信後の検査で確かめる（R2、R6） |
| II. Stop on Missing Input | 通る | 公開の操作は、題が空なら公開しない。JWT の検証の設定値が欠けたら画面も操作も止める。上限の値: 題200文字、本文100,000文字、slug 100文字、1操作あたりのクエリ2本 |
| III. Verified Scope | 通る | spec の FR と Acceptance Scenario を、R6 の段階のどれか1つに割り当てる。対応は `tasks.md` が持つ |
| IV. Partial Availability | 通る | 1つの画面が読む取得元は D1 だけで、複数の取得元を持たない。D1 が失敗したときは失敗を伝える表示にし、入力した値を残す（FR-013） |
| V. Accessible Controls | 通る | 操作はすべてネイティブの `<form>`、`<button>`、`<a>`、ラベル付きの入力で作る。削除の確認は別の画面にし、開閉を持たない（R5） |
| VI. Measure Before Optimizing | 通る | 速さのための最適化を含めない。キャッシュに載せない判断は、速さではなく正しさによる（R3） |
| VII. Boundary Translation | 通る | 外部サービスから受け取るのは Access の JWT だけ。検証する関数の中で `Author` の型に変換し、JWT の型を外に出さない |
| VIII. Portable Core | 通る | D1 の API は `src/features/note/server/` の Repository の実装に閉じる。`cloudflare:workers` を読み込むのも `server/` だけ。Access の JWT は `server/` の検証の関数に閉じる |
| IX. Simplicity | 通る | 足すインタフェースは `NoteRepository` の1つ。差し替えの対象は、単体テストの偽の実装。JWT の検証は、2つ目の機能が使うまで `features/note/server/` に置き、`shared/` に出さない |
| Test Layering | 通る | R6 |
| Display Speed | 計測で確かめる | 配信後に計測する。閾値を割ったらキャッシュを検討する |
| Cacheability | 反する | `force-dynamic` のページを置く。Complexity Tracking に書く |
| Allowlist Visibility | 通る | 訪問者向けの取り出しは、出す列を SELECT で列挙する。画面に渡す形（DTO）も出す項目だけを持つ |

## Project Structure

### Documentation (this feature)

```text
specs/005-note-write-and-read/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── routes.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks が作る
```

### Source Code (repository root)

```text
migrations/
└── 0001_create_note.sql

src/
├── app/
│   ├── notes/[slug]/page.tsx              訪問者が読む
│   └── dash/
│       ├── page.tsx                       作り手の一覧
│       └── notes/
│           ├── new/page.tsx               作る
│           └── [id]/
│               ├── page.tsx               保存する・公開する
│               └── delete/page.tsx        削除の確認
└── features/
    └── note/
        ├── domain/
        │   ├── note.ts                    slug・題・本文の規則、状態、型
        │   └── note-repository.ts         NoteRepository のインタフェース
        ├── application/
        │   └── *.ts                       ユースケース（作る、保存する、公開する、削除する、読む、一覧する）
        ├── components/
        │   └── *.tsx                      フォームと表示。'use client' はフォームの状態を持つものだけ
        └── server/
            ├── d1-note-repository.ts      Repository の実装
            ├── author.ts                  JWT の検証。作り手であることを確かめる
            ├── queries.ts                 組み立て用の関数（画面が呼ぶ）
            └── actions.ts                 Server Action（フォームが呼ぶ）

tests/
├── unit/                                  単体
├── workers/                               workerd の中の D1
├── integration/                           ビルド出力の経路
└── e2e/                                   作り手と訪問者の操作
```

**Structure Decision**: ADR-0026 のディレクトリの形に従い、機能を `src/features/note/` に置く。`shared/` には何も置かない。複数の機能で使うものがまだないため（設計原則9）。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Cacheability: `/notes/[slug]` と `/dash` 配下のページが正の `revalidate` を持たず、`force-dynamic` を宣言する | `/dash` はキャッシュに載ると作り手の画面が訪問者に返りうる。`/notes/[slug]` は、公開と削除を直後に反映するために、キャッシュの削除に頼らない（R3） | `revalidate` を付けてキャッシュに載せ、`revalidatePath` で消す案は、削除が失敗したときに削除した note が長く出続ける。constitution の文面と `tests/unit/cacheability.test.ts` が食い違っており、検査は `force-dynamic` を認めている。文面をどちらに揃えるかはオーナーが決める |
