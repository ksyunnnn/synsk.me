# Implementation Plan: 一覧

**Branch**: `feature/219-005-feed-plan` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-feed/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 再利用する既存の部品
- 一覧の読み口の置き場
- 要件と検査の対応
- 未決
- spec どうしの重なり（issue #219 の調査）
- Project Structure
- Complexity Tracking

## Summary

訪問者は一覧の画面で、職歴・実績・note・外部の activity・life event を、種類ごとの並びの日付の新しい順で 1 つの並びとして見る。005 は表を持たず、共有担当が migration で作るビュー `activity_feed` を読む（ADR-0046）。ビューの腕が、サイトに載せる職歴・実績だけ・公開の note の公開した版だけ・秘匿化した値だけ・転載先と一致しない外部の activity だけを出す。Repository の実装が種類ごとの項目を列挙して DTO に詰める（ADR-0029・ADR-0028）。

作る順は、001 の職歴と実績だけで一覧を通す細い 1 本（Walking Skeleton、tasks.md の Phase 3）を先にし、その読み口（ビューの列・Repository・DTO・並べる順）に、note（Phase 4）、外部の activity と life event（Phase 6）、重なりの除外（Phase 7）を足す。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components）、React 19.3、Tailwind CSS 4。新しい package を足さない

**Storage**: Cloudflare D1（binding `DB`）。スキーマは `migrations/0001`〜`0011` と、共有担当のビュー `activity_feed` の migration（M1〜M4、[data-model.md](./data-model.md)）。005 は書き込まない

**Testing**: Vitest 4.1.11（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（本番ビルドに対する結合）。ADR-0019 の 4 段階。一覧はオーナーの操作を持たないため E2E を足さない

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: 一覧の画面は訪問者が到達する経路で、`docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）。読み取り行数は ADR-0046 の Confirmation として D1 で測る（research.md の R8）

**Constraints**: 応答は NFR-08・NFR-09 を満たす。PR の CI は 10 分以内

**Scale/Scope**: 書き手はオーナー 1 人。訪問者のページは一覧の 1 種類。並ぶ種類は 5 つ

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 秘匿化した職歴・実績で隠す値を、ビューの列に出さない。Repository の実装も種類ごとの項目を列挙する（research.md の R4、[contracts/visitor-feed.md](./contracts/visitor-feed.md)）。005 は書き込みの経路を持たない |
| II. Stop on Missing Input | 通る | 公開・外への発信・費用のかかる処理を持たない。読み取り行数は測って 1 ページの件数を決める（R8） |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。未決が止める検査は、解けるまで範囲に入れない |
| IV. Partial Availability | 通る | 取得元は D1 のビュー 1 つ。画面は NFR-02 の状態（0 件、読み込み中、エラー＝500 の画面）で成立する。外部の取得に失敗した取得元の activity は前回の値で残る（004 の FR-014、R9） |
| V. Accessible Controls | 通る | 操作できる部品はリンク（外部の activity、ページ送り）だけで、ネイティブの `<a>` で作る |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加・非正規化を含めない。写して持つ形への移行は、測った読み取り行数が閾値を割ったときだけ（ADR-0046 の Confirmation） |
| VII. Boundary Translation | 通る | 外部のサービスとやりとりしない。D1 の行は Repository の実装の中で `FeedItem` に詰め替える |
| VIII. Portable Core | 通る | D1 は `src/features/activity/server/d1-feed-repository.ts`、env は `src/shared/server/env.ts` だけで使う |
| IX. Simplicity | 通る | `shared/` に足すものは無い。Repository のインタフェースは、単体の検査で渡す作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2） |
| Test Layering | 通る | ビューの条件は workerd、応答に値が無いことは結合、詰め替えは単体で確かめ、同じことを 2 つの段階で確かめない |
| Display Speed | 通る | 一覧の画面は NFR-03〜NFR-07 の対象。判定はフィールドの計測 |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。データを読んでから決まる 404・403 は無く、`src/proxy.ts` を変えない（R9） |
| Allowlist Visibility | 通る | DTO が出す項目を種類ごとに列挙する（contracts/visitor-feed.md） |

## 再利用する既存の部品

| 部品 | ファイル | 005 での使い方 |
|---|---|---|
| env の読み出し | `src/shared/server/env.ts`（`readEnv`） | `DB` を読む |
| 期間 | `src/shared/domain/period.ts`（`Period`） | 職歴と実績の期間の型 |
| リンク | `src/shared/components/text-link.tsx` | 外部の activity の取得元へのリンク、ページ送り |
| 手本の形 | `src/features/project/` の `domain/project-repository.ts`・`server/d1-project-repository.ts`（`VISITOR_VISIBLE`）・`server/queries.ts`・`components/visitor-project.tsx`、`src/app/projects/[slug]/page.tsx` | 同じ構成で一覧の Repository・組み立て用の関数・画面を作る |
| 検査の土台 | `tests/support/career-and-project-rows.ts`（`insertOrganization`・`insertCareer`・`insertProject`・`insertEducation`）、`tests/integration/support/d1.ts`（`startTestServer`）、`tests/workers/migrations.test.ts` | 作り物の行と、本番ビルドに対する結合 |

新しい共有の部品は要らない。note と activity の作り物の行を入れる道具は、003・004 の担当が `tests/support/` に作るものを使い、無ければ 005 の検査のファイルの中に書く。

## 一覧の読み口の置き場

種類ごとに一覧の形へ詰める部分（読み口）は、ビュー `activity_feed` の腕に置く（research.md の R2）。

| 担当 | 一覧のために足すもの |
|---|---|
| 001-career-and-project | 無し。`src/features/project`・`career` を変えない |
| 003-note | 無し。ビューが読む列（`note.status`・`note.deleted_at`・`note.published_revision_id`・`note.created_at`、`note_revision.title`・`description`、`syndication.url`）の意味を変えない（003 の research.md の R3） |
| 004-external-activity | 無し。取得元で消えた activity の行を消す（004 の research.md の R6）。`activity.sort_at` の意味を変えない |
| 共有 | ビューの migration M1〜M4（data-model.md の「要る migration の変更」） |
| 005-feed | `src/features/activity/` の一覧のファイル（`domain/feed.ts`・`domain/feed-repository.ts`・`application/list-feed.ts`・`server/d1-feed-repository.ts`・`server/feed-queries.ts`・`components/feed.tsx`）と一覧の画面。004 のファイルとは名前で分ける |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001・SC-005 | 学歴が一覧の応答に含まれない | 結 |
| FR-002 | 取得元で消えた activity は 004 が行を消すので、行の無い activity は並ばない。005 の検査は外部の activity の腕が `source <> 'life_event'` の行を並べることまで | W |
| FR-003 | 保存した life event がすべて並ぶ | W |
| FR-004・SC-006 | サイトに載せない職歴・実績が、秘匿化するかに関わらず応答に含まれない | W（ビュー）・結（応答） |
| FR-005・FR-006・SC-002 | 下書き・削除・下書きに戻した note と、公開した後に保存した版の題が応答に含まれない。並ぶ note は公開した版の題 | W・結 |
| FR-007・FR-009 | 種類ごとの並びの日付で並ぶ。職歴・実績は始まりの日で、終わりの日を使わない | W |
| FR-008 | 公開・公開し直し・下書きから公開に戻しても並びの位置が変わらない | W |
| FR-010・SC-004 | 並びの日付が同じ組を含めて決まった順で、2 回続けて読んだ順が同じ | W（種類をまたぐ同じ日の組は U3 が解けてから） |
| FR-011 | 同じ日の life event が外部の activity より古い位置に並ぶ | W（U3 が解けてから） |
| FR-012・FR-013・SC-001 | 秘匿化した職歴・実績が出してよい値だけで並び、HTML と RSC の応答に実際の題・実際の組織名・本文の中身・関連 URL・画像が無い | 単（詰め替え）・結（応答） |
| FR-013 の伏せた見た目 | 秘匿化した行の本文の場所に「非公開」が出る | 結 |
| FR-014 | 秘匿化しない実績・職歴が実際の題と組織名で並ぶ | 結 |
| FR-015 | ビューが値を外し、画面は DTO だけを受け取る | 構成が持つ（R2・R4）。検査は FR-012〜FR-013 と同じ |
| FR-016・FR-017・SC-003 | 公開の note の転載先と一致する外部の activity が並ばず、note が下書きか削除なら並ぶ。一致しないものは並ぶ | W |
| FR-018・FR-019 | 種類と、外部の activity・life event の取得元と分類が DTO にある | 単 |
| FR-020 | 外部の activity が取得元の URL へリンクする | 結 |
| FR-021 | 組織名を直した直後の一覧で、秘匿化しない職歴・実績が直した組織名で並ぶ | 結 |
| NFR-02 | 0 件の一覧が 200 で 0 件の表示を返す | 結 |

## 未決

この plan では決めない。止めるタスクは tasks.md が「止める未決: U<n>」で示す。番号は 005 の中だけの番号で、001・003・004 の plan.md の U と別のもの。

| ID | 未決 | 決める人 | 止める範囲 |
|---|---|---|---|
| U1 | 一覧を見せる画面の名前と URL（spec の「決定が無く」）。PM が推奨 `/` をオーナーに聞いている | オーナー | 一覧の画面（`src/app/` の `page.tsx`）と結合の検査。Repository・DTO・並べる計算は止めない |
| U2 | 並びの日付が同じとき、どの種類を先に並べるか（spec の「決定が無く」）。仮の順（note・外部の activity・life event・実績・職歴）で作る（2026-11-09、PM の回答） | オーナー | 無し。決まれば `FEED_ITEM_TYPES` の配列を直す |
| U3 | 暦の日付と日時が同じ日のときの順と、日の境目の時刻帯（spec の「決定が無く」）。004 の plan.md の U12（オーナーが入れる日付の持ち方）の答えを待つ（2026-11-09、PM の回答） | オーナー | 種類をまたいで同じ日の順を確かめる検査（FR-011、SC-004 の同じ日の組） |
| U4 | 一覧から note・実績・life event の個別のページへリンクするか（spec の「決定が無く」） | オーナー | 無し。決まるまでリンクせず、slug を DTO に入れない |
| U5 | 一覧に代表画像を出すか、外部の activity の代表の画像の出し方（spec の「決定が無く」、issue #186「URL カードの画像の出し方を決める」） | オーナー | 無し。決まるまで画像を DTO に入れない |
| U6 | 転載先の URL と外部の activity の URL が一致するとみなす条件（spec の「決定が無く」） | オーナー | 無し。決まるまで文字列の完全一致（research.md の R7） |
| U7 | 一覧の activity に並べる値（使ったスキル、秘匿化しない行の本文、実績の期間の見せ方、職歴の終わりの日を出すか。spec の Assumptions は UI を考えるときに決めるとする） | オーナー（デザイン） | 無し。決まるまで contracts/visitor-feed.md の最小の値 |

依存（未決ではない）: 共有担当のビューの migration M1〜M4（data-model.md）。tasks.md は「止める依存: M<n>」と書く。

## spec どうしの重なり（issue #219 の調査）

issue #219 のコメント「spec どうしの重複・干渉・矛盾・依存を調べた」のうち、005 に関わる指摘の扱い。

| 指摘 | 扱い |
|---|---|
| 干渉: `src/features/career/server` に、001 の残りのタスクと 005 の訪問者向けの取り出しが手を入れる | 005 は `src/features/career/` を変えない。職歴の訪問者向けの取り出し（001 の data-model.md、research.md の R15）は、ビューの職歴の腕と `src/features/activity/server/d1-feed-repository.ts` が持つ |
| 干渉: ER 図の `gen_er8.py`・`er-options.html` を 003・004・005 が直すと衝突する | 005 は変えない。ビューを載せるかは共有担当が決める |
| 干渉: migration の番号 | 005 は migration を書かない。ビューは共有担当が M1〜M4 として書く |
| 依存: 005 → 001・003・004 | Walking Skeleton（Phase 3）は 001 の表とビューの M1 だけを待つ。note・外部の activity・life event の腕は 003・004 のコードを待たず、表（0004・0005）に作り物の行を入れて確かめる。003・004 が列の意味を変えないことは「一覧の読み口の置き場」の表 |
| spec が ADR-0044 を指す | ADR-0044 は ADR-0046 に置き換わった。ADR-0046 は一覧の決定（ビュー、秘匿化をビューに書く、並べるキー）を変えずに引き継ぐ。この plan は ADR-0046 を根拠にする |
| 画像・書きかけの保持・slug・uid | 005 は画像を配らず、入力も管理画面も持たないため、どれも使わない |

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
src/
├── app/
│   └── {U1 の URL}/page.tsx・loading.tsx    一覧の画面（訪問者）
└── features/
    └── activity/                            004 と同じ機能。一覧のファイルは名前で分ける
        ├── domain/        feed.ts（FEED_ITEM_TYPES・FeedItem）・feed-repository.ts
        ├── application/   list-feed.ts
        ├── components/    feed.tsx
        └── server/        d1-feed-repository.ts・feed-queries.ts

tests/
├── unit/          feed.test.ts（詰め替え・順の配列）・list-feed.test.ts
├── workers/       feed-repository.test.ts（本物の migrations/ を当てる）
└── integration/   feed.test.ts（一覧の応答）
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。`src/features/activity/server/feed-queries.ts` が組み立て用の関数を持ち、`page.tsx` はそれを呼ぶ（ADR-0030）。U1 の URL が `/` のときは `src/app/page.tsx` を一覧の画面に置き換え、`tests/e2e/home.spec.ts` を直す。

## Complexity Tracking

constitution に反するものは無い。
