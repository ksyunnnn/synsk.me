# Implementation Plan: 外部 activity の取得

**Branch**: `feature/219-004-external-activity-plan` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-external-activity/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 再利用する既存の部品
- 要件と検査の対応
- 未決
- spec が決めないものの扱い
- spec どうしの重なり（issue #219 の調査）
- Project Structure
- Complexity Tracking

## Summary

システムが一覧を取る取得元（Zenn・Qiita・dev.to・Medium・GitHub・Speaker Deck・connpass）から項目を取り、取得元ごとの処理の中で synsk.me の型に詰め替え（Anti-Corruption Layer）、`activity` に保存する。取得は Cron Triggers の定期実行で走らせる（U10 の決定、2026-11-09）。取得元ごとに「読む → 計算 → 書く」を行い、`Promise.allSettled` で並べて、1 つの失敗でほかを止めない（失敗の表し方）。取得元で消えたと確かめた activity は行を消し、確かめられないあいだと上限を超えた分は残す。URL を指名する取得元（Spotify・X・CodeSandbox・YouTube）と手で入力する取得元（CodePen）の activity は、オーナーが `/dash/activities` で登録・削除する。life event はオーナーが `/dash/life-events` で作り、訪問者は `/life-events/{slug}` で個別のページを見る。life event の代表画像は R2 の原本を Worker が確かめて変換せずに返す（U5 の決定、2026-11-09）。

001・002 の作り（機能のディレクトリの形、Repository・DTO・組み立て用の関数・Server Action・proxy・オーナーの判定）をそのまま使う。004 は migration を書かず、要る変更を共有担当に渡す（[data-model.md](./data-model.md) の「要る migration の変更」）。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components・Server Actions）、React 19.3、`jose`（001 のオーナーの判定）、Tailwind CSS 4。RSS は package を足さずに読む（[research.md](./research.md) の R3）

**Storage**: Cloudflare D1（binding `DB`）。スキーマは `migrations/0001`〜`0011` と共有担当の migration（`activity.uid`・取得元の行。research.md の R1）。画像は R2（binding `NOTE_IMAGES`）を共有担当の `src/shared/server/media-storage.ts` 越しに使う。形式は JPEG・PNG・WebP・GIF、1 枚 10 MB まで（U5 の決定）

**Testing**: Vitest 4.1.11（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（本番ビルドに対する結合）、Playwright（E2E、Chromium）。ADR-0019 の 4 段階。取得元の応答は作り物を `fetcher` に渡し、検査から外へ要求を出さない

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: 訪問者が到達する `/life-events/{slug}` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）。取得の処理は訪問者の経路に乗らない

**Constraints**: 応答は NFR-08・NFR-09 を満たす。`/dash` の応答は `no-store`。外への要求の上限は research.md の R8（U13）。D1 の 1 日の書き込みの上限は 10 万行（spec の Assumptions）。PR の CI は 10 分以内

**Scale/Scope**: 書き手はオーナー 1 人。取得元は一覧を取る 7、URL を指名する 4、手で入力する 1、登録していないサイト 1、life event 1。管理画面は 2 種類（life event、URL を指名した・手で入力した外部の activity）、訪問者のページは life event の個別のページ 1 種類

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 書き込みの Server Action は先頭でオーナーを確かめ、オーナーでない呼び出しが `activity`・`fetch_result` を変えないことを結合で確かめる（[contracts/dash.md](./contracts/dash.md)）。取得元の認証情報は secret に置き、保管するデータと応答に出さない（R15） |
| II. Stop on Missing Input | 条件付きで通る | 外への要求の上限の値は research.md の R8 にある。値はオーナーの承認待ち（U13）で、承認まで取得の入口を作らない。connpass はキーが欠ければ要求を出さない。日付の無い外部の activity は保存しない（FR-011）。URL を指名する取得元は、その取得元のホストの URL にだけ要求を出す（R10）。画像は 1 枚 10 MB まで、1 つの life event に 1 枚まで（R12） |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。未決が止める要件は、解けるまで範囲に入れない |
| IV. Partial Availability | 通る | 取得元ごとに `Promise.allSettled` で並べ、取得元ごとに `batch()` で書く（R4）。失敗した取得元の activity は前回の値で残る（FR-014）。life event のページの取得元は D1 の 1 つ |
| V. Accessible Controls | 通る | 入力はネイティブの要素と `<form>`。削除の確認は別のページ（001 と同じ）。E2E でキーボードだけの操作を確かめる |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加・非正規化を含めない。値が変わった行だけを書くのは D1 の書き込みの上限という費用の上限のためで、速さのためではない（R5） |
| VII. Boundary Translation | 通る | 取得元の応答は `server/sources/<取得元>.ts` の中で `FetchedItem` に詰め替え、外部の型をファイルの外に出さない（R3、[contracts/fetch.md](./contracts/fetch.md)） |
| VIII. Portable Core | 通る | D1 は `src/features/activity/server/d1-activity-repository.ts`、R2 は `src/shared/server/media-storage.ts`、env は `src/shared/server/env.ts` だけで使う。Cron の `scheduled` は `worker/index.ts` だけに置く |
| IX. Simplicity | 通る | `shared/` に新しく置くものは無い。Repository のインタフェースは、単体の検査で渡す作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2）。`fetcher` の引数は、単体の検査で渡す作り物の応答が 2 つ目の使い手 |
| Test Layering | 通る | 同じことを 2 つの段階で確かめない（下の表の「段階」） |
| Display Speed | 通る | life event のページは NFR-03〜NFR-07 の対象。判定はフィールドの計測 |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。404 と 403 は `src/proxy.ts` が決め、`tests/unit/proxy.test.ts` が確かめる |
| Allowlist Visibility | 通る | 訪問者向けの DTO が出す項目を列挙する（[contracts/visitor-life-event.md](./contracts/visitor-life-event.md)） |

## 再利用する既存の部品

001・002 が作ったものを、形を変えずに使う。足りないものは共有担当が作る（2026-11-09、PM の回答）。

| 部品 | ファイル | 004 での使い方 |
|---|---|---|
| オーナーの判定 | `src/shared/server/author.ts`（`requireAuthor`・`getCurrentAuthor`） | 管理画面の読み出しと Server Action の先頭 |
| env の読み出し | `src/shared/server/env.ts`（`readEnv`） | `DB` と、取得元の認証情報の型を足して読む（R15） |
| 管理画面の uid | `src/shared/domain/uid.ts`（`parseUid`・`findIdByUid`） | `/dash/life-events/{uid}`・`/dash/activities/{uid}` |
| Server Action の結果 | `src/shared/domain/action-result.ts`（`ActionResult`） | 4 つの登録・編集の結果 |
| フォームの値 | `src/shared/server/form-data.ts`（`readString`） | Server Action の入力 |
| 空の入力 | `src/shared/domain/empty-to-null.ts` | 説明・題の空 |
| URL の形 | `src/shared/domain/web-url.ts`（`isWebUrl`） | URL を指名する・手で入力する登録 |
| 入力の部品 | `src/shared/components/field.tsx`、`src/shared/components/text-link.tsx` | 管理画面の入力とリンク |
| 削除の確認 | `src/shared/components/delete-form.tsx` | `/dash/life-events/{uid}/delete`・`/dash/activities/{uid}/delete` |
| proxy | `src/proxy.ts` | matcher に `/life-events/:slug` を足し、`/dash/life-events/{uid}`・`/dash/activities/{uid}` の有無を足す |
| 手本の形 | `src/features/project/` の `domain/project-repository.ts`・`server/d1-project-repository.ts`・`server/queries.ts`・`server/actions.ts`・`application/deps.ts`・`application/register-project.ts`・`components/visitor-project.tsx`、`src/app/projects/[slug]/page.tsx`・`missing/page.tsx`、`src/app/dash/projects/*` | 同じ構成で `src/features/activity/` と画面を作る |
| 検査の土台 | `tests/support/access.ts`、`tests/integration/support/`、`tests/e2e/support/author.ts`、`tests/workers/migrations.test.ts` | 結合・E2E のオーナー、D1 の作り物の行 |
| 共有担当が作る: slug の部品 | `src/shared/domain/slug.ts`（`isSlug`・`newSlug`。PR #222「書きかけの保持の部品と slug の検査を src/shared/ にまとめた」） | life event の slug の形と既定値（FR-035） |
| 共有担当が作る: 書きかけの保持 | `src/shared/components/draft-retention.tsx`（001 の T072） | life event と外部の activity の入力（REQUIREMENTS.md の FR-14） |
| 共有担当が作る: 画像の保存と配信 | `src/shared/server/media-storage.ts`（001 の T075） | life event の代表画像の保存・配信・削除。形式と大きさの検査もこの部品を使う |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001・FR-002・FR-003 | 分類は `activity_source.kind` の 4 値。activity に分類の列が無い。取得元の名前が種類ごとに分かれている | W（migration）・スキーマが持つ |
| FR-004 | 取得元の取り方が保管するデータに無い。認証情報を secret から読む | スキーマが持つ・単（connpass のキーの欠け） |
| FR-005・FR-008・SC-001 | 2 回続けて取り直しても同じ項目が 1 行。ID を返さない取得元は URL で 1 行 | 単（`planRefresh`）・W（Repository と UNIQUE） |
| FR-006・FR-007 | 取得元の応答から題・URL・公開日（返すときは ID と画像の URL）を持つ行を作る | 単（取得元ごとの処理に作り物の応答を渡す） |
| FR-009・FR-010・FR-011 | URL を指名して日付つきで登録すると題を取って保存する。日付が無ければ保存しない。手で入力した値で保存する | 単（ユースケース）・W（保存）・E（入力） |
| FR-012・SC-005 | 公開日の無い項目で `published_at` を書かない。URL を指名した activity は取得で取り直さず、日付はオーナーの入力の値だけで書く（research.md の R5） | 単（`planRefresh`）・W |
| FR-013 | 取り直しても `created_at` が変わらない | W |
| FR-036 | `wrangler.jsonc` に `triggers` があり、`scheduled` が `refreshSources` を呼ぶ（research.md の R9）。ビルドした `dist/server/wrangler.json` に `triggers` があることは quickstart.md の手順 1 で確かめる | 単 |
| FR-014・FR-015・SC-002 | 2 つのうち 1 つの取得元が失敗しても、失敗した側の行が残り、もう一方が取り込まれる | 単（`refreshSources`）・W（`batch()` の分け方） |
| FR-016 | 失敗の結果に日時・理由が書かれ、2 回続けて失敗しても `last_succeeded_at` が残る | 単・W |
| FR-017・SC-003 | 消えたと確かめた activity の行が消え、一覧の対象に残らない | 単（`planRefresh`）・W |
| FR-018・SC-004 | `isComplete` が偽の取得元で、一覧に無い activity を消さない | 単（`planRefresh`） |
| FR-019 | 消す候補が上限を超えたら、超えた分を残し、理由を書く | 単（`planRefresh`） |
| FR-020 | 応答の形の誤り・取得の失敗で消さない | 単 |
| FR-021 | 手で付ける値の列が無い | スキーマが持つ（ADR-0052 の Confirmation） |
| FR-022・FR-033 | URL を指名した・手で入力した activity を削除できる。一覧を取る取得元の activity は削除の操作が無く、Server Action も拒む | 単（ユースケース）・W・E |
| FR-023・FR-024・FR-025 | life event の作成・編集・削除。起きた日の必須。リンク先の入力が無い | 単（ユースケース）・W・E |
| FR-026 | 保存した life event はすべて個別のページが 200 | 結 |
| FR-027・SC-006 | 削除した life event の行と画像の行と R2 のものが残らない | W |
| FR-028・FR-029・FR-030 | 代表画像の登録（形式と 10 MB の上限）、ほかの life event の画像を選べない、サイトを通して配る | W（登録と選べないこと）・結（配る経路の 200・404） |
| FR-031・FR-032 | オーナーでない呼び出しが何も書かない。取得の処理が life event の行を書かない | 結（Server Action）・W（取得の書き込み） |
| FR-034・SC-007 | `/life-events/{slug}` が 200、無い slug で 404、外部の activity に個別のページが無い | 結・単（proxy） |
| FR-035 | 識別子を入れなければ推測できない値。形と重複を拒む。書き換えられる | 単（決まり）・W（重複） |

## 未決

この plan では決めない。止めるタスクは tasks.md が「止める未決: U<n>」で示す。004 で足す未決は、001 の plan.md の未決（U1〜U9）と番号が重ならないよう U10 から付ける。001 の U5（画像の形式と大きさの上限、画像を配る経路）は 2026-11-09 に決まった（issue #219 のコメント「U5 を Claude が決めた」）: R2 の原本を Worker が確かめて変換せずに返す。JPEG・PNG・WebP・GIF、1 枚 10 MB まで。U10（取得を走らせる時機）は 2026-11-09 にオーナーが Cron Triggers の定期実行に決めた（issue #219 のコメント「取得を走らせる時機（004-external-activity の U10）と、epic 宛ての PR の CI の扱いをオーナーが決めた」）。更新が無いのに実行が回り続ける無駄を抑える作りは research.md の R9 が持つ。

| ID | 未決 | 決める人 | 案と推奨（理由は research.md） | 止める範囲 |
|---|---|---|---|---|
| U11 | 登録していないサイトの題の取り方と、取得元が題を返さない URL を指名したときの扱い（spec の未決） | オーナー | (a) 手で入力する (b) OG メタから取る。推奨 (a)（R10） | 登録していないサイトの登録（T053）と、題を取れないときの扱い（T050 の分岐） |
| U12 | オーナーが登録する日付の持ち方 | オーナー | (a) その日の UTC の 00:00 を `published_at` に入れる (b) 暦の日付の列を足す。推奨 (a)（R10） | URL を指名する・手で入力する登録の保存（T050〜T053）と、共有担当への migration の依頼 |
| U13 | 外への要求の上限の値、Cron の実行の間隔、1 回の実行の要求の総数と取得元への配り方、1 回の実行で扱う取得元の分け方（constitution II、Workers Free の CPU 10 ms と subrequest 50 本） | オーナー | research.md の R8 の表 | 本番の上限の値（T018）と取得の入口（T040）。ユースケースは上限を引数で受け取るので止めない |

依存（未決ではない）: `activity.uid` と取得元の行を足す共有担当の migration（data-model.md の「要る migration の変更」）。D1 を使う検査（workerd・結合・E2E）のうち、uid と取得元の行を使うものは、その migration が epic に入ってから回す。tasks.md は「止める依存: 共有担当の migration」と書く。

## spec が決めないものの扱い

spec の「決定が無く、この spec では決めない」のうち、作るものに関わるものの扱い。決まればタスクを足す。

| spec の未決 | この plan の扱い |
|---|---|
| 取得の結果をオーナーに見せる画面を持つか | 作らない。`fetch_result` に書くだけ |
| 外部の activity の代表の画像の出し方 | `image_url` に URL を持つだけで、画像を保管しない。出し方は 005 と issue #186「URL カードの画像の出し方を決める」 |
| life event の題を必ず入れるか | 必須にしない（`activity.title` は NULL 可、spec に要件が無い） |
| life event の説明の書式と、説明の中に画像を置けるか | 説明は文字列で持ち、改行を保つ文字だけで見せる。書式は 001 の U4（本文の書式）が決まってから合わせる |
| life event の個別のページに出す値と見せ方 | DTO の値（contracts/visitor-life-event.md）を出す。見せ方はデザインで決める |
| 取得元が題を返さない URL を指名したときの扱い | U11 |
| 取得元の分類を変える手順 | 作らない。`activity_source.kind` を変える migration で行う |

## spec どうしの重なり（issue #219 の調査）

issue #219 のコメント「spec どうしの重複・干渉・矛盾・依存を調べた」のうち、004 に関わる指摘の扱い。

| 指摘 | 扱い |
|---|---|
| 画像の保存と配信の持ち主が決まっていない（004 の FR-030 だけが「003 が持つ」とする） | 共有担当の `src/shared/server/media-storage.ts` を使い、004 では作らない（2026-11-09、PM の回答） |
| slug の形が 001・002・003・004 で同じ | 共有担当の `src/shared/domain/slug.ts` を使い、`src/features/activity/` に同じ関数を書かない |
| 書きかけの保持（001 の T072、003 の FR-018） | 共有担当の `src/shared/components/draft-retention.tsx` を使う |
| migration の番号が 003 と 004 で重なりうる | 004 は migration を書かない。要る変更は共有担当がまとめて書く |
| media の表に 001・003・004 が書き込む | 004 は `media.activity_id` の行だけを、共有担当の部品越しに書く |
| ER 図の `gen_er8.py`・`er-options.html` | 004 は変えない |
| 「uid」の意味の食い違い（FR-035 は 36 文字、ADR-0051 は 32 文字） | 別の列として扱う。slug の既定値は推測できない値、管理画面の URL は `activity.uid`（research.md の R11） |
| ADR-0051 の uid が activity の表に無い | 共有担当の migration で足す（data-model.md） |
| 依存: 004 → 001・003（画像） | 001 の作りを手本にし、画像は共有担当の部品が入ってから作る |
| 依存: 005 → 004 | 005 は `activity` を自分の機能の中で読む。004 は 005 のために読み出しを作らない。行を消す形（R6）なので、005 は消えた activity を除く条件を持たなくてよい |

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
│   ├── fetch.md
│   ├── visitor-life-event.md
│   └── dash.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

ADR-0026 のディレクトリの形と依存の向きに従う。機能どうしは import しない。

```text
src/
├── proxy.ts                           /life-events/:slug の 404、/dash/life-events/{uid}・/dash/activities/{uid} の 404 を足す
├── app/
│   ├── life-events/[slug]/page.tsx    life event の個別のページ（訪問者）
│   ├── life-events/[slug]/missing/page.tsx
│   ├── life-events/[slug]/media/[id]/route.ts  life event の代表画像を配る
│   └── dash/
│       ├── page.tsx                   入口に 2 つを足す
│       └── life-events/  activities/
│           各 page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx
├── features/
│   └── activity/
│       ├── domain/        sources.ts（取得元の表）・limits.ts・fetched-item.ts・external-activity.ts・life-event.ts・activity-repository.ts
│       ├── application/   refresh-sources.ts・plan-refresh.ts・register-external-activity.ts・edit-external-activity.ts・delete-external-activity.ts・register-life-event.ts・edit-life-event.ts・delete-life-event.ts・get-visitor-life-event.ts・deps.ts
│       ├── components/    life-event-form.tsx・external-activity-form.tsx・visitor-life-event.tsx
│       └── server/
│           ├── d1-activity-repository.ts
│           ├── queries.ts  actions.ts
│           └── sources/   fetch-with-limits.ts・zenn.ts・qiita.ts・devto.ts・medium.ts・github.ts・speakerdeck.ts・connpass.ts・spotify.ts・x.ts・codesandbox.ts・youtube.ts
└── shared/                            既存を使う。新しく足さない（共有担当の部品を除く）

worker/index.ts                        scheduled を足す（U10 の決定）

tests/
├── unit/          取得元ごとの処理（作り物の応答）・plan-refresh・refresh-sources・各ユースケース・proxy
├── workers/       d1-activity-repository（本物の migrations/ を当てる）・migrations（uid）
├── integration/   /life-events/{slug}・/dash の書き込みの拒否
├── e2e/           life event と外部の activity の登録・編集・削除
└── support/       activity の作り物の行
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。`src/features/activity/server/` が組み立て用の関数（`queries.ts`）と Server Action（`actions.ts`）を持ち、`page.tsx` と `src/proxy.ts` はそれを呼ぶ（ADR-0030・ADR-0040）。CodePen は手で入力するので取得元の処理のファイルを持たない。

## Complexity Tracking

constitution に反するものは無い。
