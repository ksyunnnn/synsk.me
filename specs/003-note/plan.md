# Implementation Plan: note

**Branch**: `feature/219-003-note-plan` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-note/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 再利用する既存の部品
- 要件と検査の対応
- 参照先への取得の上限
- 未決
- Project Structure
- Complexity Tracking

## Summary

オーナーが管理画面（`/dash/notes`）で note を作り、保存のたびに版を 1 つ足し、公開・下書きに戻す・削除・元に戻す・過去の版に戻すを行う。訪問者は `/notes/{slug}` で、公開で削除していない note の公開した版だけを読む。版は `note_revision` に足すだけで書き換えず、保存は開いたときの最も新しい版と比べて、違えば止める（[research.md](./research.md) の R4。2026-11-09 にオーナーが決めた）。

オーナーの判定・env・Server Action の結果の型・入力の部品・uid の引き方・proxy の形は 001・002 のものを使う（下の「再利用する既存の部品」）。書きかけの保持・slug の形の検査・画像の保存と配信・Markdown を読む部品と描く部品は共有担当が `src/shared/` に作り、003 は使う。本文は Markdown で、生の HTML を通さない（U4、2026-11-09 にオーナーが決めた。R11）。画像は R2 の原本を Worker が確かめて変換せずに返す（U5、2026-11-09 に決めた。R12）。残る未決に依るタスクは、tasks.md が「止める未決: U<n>」で示す。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components・Server Actions）、React 19.3、`jose`（001 のオーナーの判定）、Tailwind CSS 4。003 は package を足さない。Markdown の package は共有担当の Markdown の部品が足す（research.md の R11）

**Storage**: Cloudflare D1（binding `DB`）。スキーマは `migrations/0001`〜`0011` と、共有担当の migration で足す `note.uid`・`note_revision.uid`（research.md の R1）。画像は R2（binding `MEDIA`）を共有担当の `src/shared/server/media-storage.ts` 越しに使う（R12）

**Testing**: Vitest 4.1.11（単体）、`@cloudflare/vitest-plugin`（workerd と D1）、`createTestHarness()`（本番ビルドに対する結合）、Playwright（E2E、Chromium。スマートフォンの端末の設定を含む）。ADR-0019 の 4 段階

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: 訪問者が到達する `/notes/{slug}` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）

**Constraints**: 応答は NFR-08・NFR-09 を満たす。`/dash` の応答は `no-store`。PR の CI は 10 分以内。題は 200 文字・本文は 100,000 文字まで（FR-005）

**Scale/Scope**: 書き手はオーナー 1 人。管理画面は note の一覧・作成・編集・版の一覧・過去の版・見た目の確認・削除の確認。訪問者の経路は note のページと note の画像の 2 種類

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 訪問者向けの取り出しは、公開で削除していない note の公開した版だけを読む（R7、[contracts/visitor-note.md](./contracts/visitor-note.md)）。画像は公開で削除していない note の、公開した版の本文と代表画像だけを出し、公開していない画像は `no-store`（R12）。書き込みの Server Action は先頭でオーナーを確かめ、オーナーでない呼び出しが何も書かないことを結合で確かめる（[contracts/dash.md](./contracts/dash.md)） |
| II. Stop on Missing Input | 条件付きで通る | 公開は題が空なら止める（FR-011）。画像の追加は 1 回の操作で 1 枚、1 枚 10 MB まで、形式は JPEG・PNG・WebP・GIF（R12）。参照先への取得は、1 回に取る URL の数・リダイレクトの段・時間・大きさに上限をかけ、内部のアドレスへ要求を出さない（下の「参照先への取得の上限」） |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。U が止める要件は、解けるまで範囲に入れない |
| IV. Partial Availability | 通る | ページの取得元は D1 の 1 つ。URL カードの参照先の情報が無い URL も note を出す（spec の Edge Cases、R13）。画面は NFR-02 の状態で成立する |
| V. Accessible Controls | 通る | 入力はネイティブの要素と `<form>`。E2E でキーボードだけの操作とスマートフォンの端末の設定を確かめる（R16） |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加・版をまとめる仕組みを含めない。版の大きさを測る SQL を quickstart.md に置く（R17） |
| VII. Boundary Translation | 通る | D1 の行は Repository の実装の中で domain の型に詰め替える。参照先から取った HTML は取得のモジュール（`src/shared/server/link-preview-fetch.ts`）の中で題と画像の URL に詰め替える（R13） |
| VIII. Portable Core | 通る | D1 は `src/features/note/server/d1-note-repository.ts`、R2 は共有担当の `src/shared/server/media-storage.ts`、env は `src/shared/server/env.ts` だけで使う |
| IX. Simplicity | 通る | `shared/` に新しく置くものは無い（共有担当が置くものは、001・003・004 を 2 つ以上の使い手として共有担当が挙げる）。Repository のインタフェースは、単体の検査で渡す作り物の実装が 2 つ目の使い手（ADR-0026 のルール 2） |
| Test Layering | 通る | 同じことを 2 つの段階で確かめない（下の表の「段階」） |
| Display Speed | 通る | `/notes/{slug}` は NFR-03〜NFR-07 の対象。判定はフィールドの計測 |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。ページの 404 と 403 は `src/proxy.ts` が決め、`tests/unit/proxy.test.ts` が確かめる。描画しない画像の `route.ts` は自分で 404 と `no-store` を返す（R9） |
| Allowlist Visibility | 通る | 訪問者向けの DTO が出す項目を列挙する（contracts/visitor-note.md） |

## 再利用する既存の部品

001・002 が作ったものを変えずに使う。003 が足すのは `src/features/note/` と、下の「足すところ」の行だけ。

| 部品 | ファイル | 003 での使い方 |
|---|---|---|
| オーナーの判定 | `src/shared/server/author.ts`（`requireAuthor`・`getCurrentAuthor`・`getAuthorFromHeaders`）、`src/shared/domain/author.ts` | ページの描画の前、Server Action とユースケースの先頭、`src/proxy.ts` |
| env | `src/shared/server/env.ts`（`readEnv`） | `DB` を読む。003 は型を足さない |
| Server Action の結果 | `src/shared/domain/action-result.ts`（`ActionResult`） | `saved`・`forbidden`・`invalid`・`conflict` |
| フォームの値の読み方 | `src/shared/server/form-data.ts`（`readString`・`readValues`） | 各 Server Action |
| uid の形と引き方 | `src/shared/domain/uid.ts`（`parseUid`・`findIdByUid`） | note と版の uid から主キーを引く |
| 空の値 | `src/shared/domain/empty-to-null.ts` | 説明文が空なら NULL |
| URL の形 | `src/shared/domain/web-url.ts`（`isWebUrl`） | 転載先の URL |
| 入力の部品 | `src/shared/components/field.tsx`、`src/shared/components/text-link.tsx` | 識別子・題・説明文・本文・転載先の入力、リンク |
| 削除の確認 | `src/shared/components/delete-form.tsx` | `/dash/notes/{uid}/delete` |
| プレビュー配信の no-store | `src/shared/server/preview-no-store.ts` | 変えずに効く |
| 書きかけの保持 | `src/shared/components/draft-retention.tsx`（`DraftRetainingForm`。共有担当、001 の T072、PR #222） | 編集の画面。`version` に開いた版の uid を渡す（R10） |
| slug の形の検査 | `src/shared/domain/slug.ts`（`isSlug`。共有担当、PR #222） | 識別子の検査（R8）。`newSlug` は使わない |
| 画像の保存と配信の共通部分 | `src/shared/server/media-storage.ts`（共有担当、PR #225） | note の画像の追加と配信。配る応答は `respondWithMedia`（R12） |
| Markdown を読む部品と描く部品 | `src/shared/` の Markdown の部品（共有担当。ファイル名は共有担当の PR で確かめる） | 本文の表示、本文が指す画像と URL の読み出し、説明文が空のときの冒頭（R11） |
| 参照先の題と画像の取得 | `src/shared/server/link-preview-fetch.ts`（`fetchLinkPreviews`。003 が作り、004 の issue #281 も使う） | 見た目の確認の画面で、参照先の情報を持たない URL を取る（R13） |

形の手本（同じ形で書く。import はしない）:

| 形 | 手本 |
|---|---|
| Repository のインタフェースと D1 の実装 | `src/features/project/domain/project-repository.ts`、`src/features/project/server/d1-project-repository.ts` |
| 組み立て用の関数 | `src/features/project/server/queries.ts` |
| Server Action | `src/features/project/server/actions.ts` |
| ユースケースと Dependency Injection | `src/features/project/application/deps.ts`・`edit-project.ts` |
| 訪問者のページと 404 の画面 | `src/app/projects/[slug]/page.tsx`・`missing/page.tsx` |
| 見た目の確認の画面 | `src/app/dash/resumes/[id]/preview/page.tsx` |
| 子の行の画面の 404（note の版） | `src/proxy.ts` の `findMissingResumeRow` の分岐、`src/features/resume/server/queries.ts` |
| 検査の道具 | `tests/support/access.ts`、`tests/support/career-and-project-rows.ts`、`tests/integration/support/`、`tests/e2e/support/` |

足すところ: `src/proxy.ts`（`/notes/:slug` と `/dash/notes/*`）、`src/app/dash/page.tsx`（入口のリンク）、`tests/unit/proxy.test.ts`、`tests/integration/dash-url-without-id.test.ts`。

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001 | 作った note が下書きで、1 つ目の版を持つ | W |
| FR-002 | 識別子の形を拒む。削除した note の識別子と重なる作成を拒む（User Story 2 の 4） | 単（形）・W（重複） |
| FR-003・User Story 1 の 6 | 一度も公開していない note の識別子を変えられ、公開したことのある note では拒む | 単（判定）・W（トリガ） |
| FR-004 | 公開の note が `/notes/{slug}` で 200、応答に主キーが無い | 結 |
| FR-005 | 題 201 文字・本文 100,001 文字を拒み、説明文は空で保存できる | 単 |
| FR-006・FR-008・SC-003・User Story 3 の 1 | 3 回保存すると 3 つの版が保存したときのまま読める | W |
| FR-007 | 編集の画面が最も新しい版の中身で始まる | W（取り出し）・E |
| FR-009・User Story 3 の 2・3 | 過去の版に戻すと新しい版として足され、公開した版は変わらない | W・結（訪問者の応答） |
| FR-010・FR-011・User Story 1 の 2・3 | 題が空の版の公開を拒み、題があれば公開する | 単（ユースケース）・W（トリガ）・結 |
| FR-012・SC-001・User Story 1 の 4 | 公開した後に保存した版が訪問者の応答に無い | 結 |
| FR-013・SC-004・User Story 1 の 5・User Story 2 の 2 | 公開し直し・下書きに戻した後に、初めて公開した日時と URL が変わらない | W・結 |
| FR-014・FR-015・User Story 1 の 1・User Story 2 の 1 | 下書きと下書きに戻した note が 404 で、中身が応答に無い。公開した版が残る | W・結 |
| FR-016・SC-007・User Story 2 の 3・5・6 | 削除した note が 404。元に戻すと削除前の状態・版・識別子 | W・結 |
| FR-017 | 完全に消すと note・版・画像・転載先が消え、参照先の情報は残る。途中で失敗すると何も消えない | W（画面は作らない） |
| FR-018・FR-019・User Story 4 の 1・2 | 保存せずに再読み込みしても書きかけが残る。別の端末（別の文脈）では最後に保存した版が出る | E（共有担当の部品を使う） |
| FR-020・FR-021・SC-002・User Story 4 の 3・4 | 開いた後に別の画面で保存されていたら書かず、続けて 2 回の保存は通る | W（判定）・E（知らせと入力が残ること） |
| FR-022・SC-006 | スマートフォンの端末の設定で作成・保存・公開 | E |
| FR-023・FR-025 の画像・FR-026・User Story 5 の 1・3〜5 | 公開した版の本文が指す画像の id を読む（コードの中の印を拾わない） | 単（本文の読み方）・W（追加と代表画像）・結（配る経路の 200・404 と `no-store`） |
| FR-024・User Story 5 の 2 | 代表画像を選ばなければ `site`。D1 は `generated` を持てない。note のページは `twitter:card` が `summary`。`media` の note は `og:image` と `twitter:image` が原本の経路を 1 つだけ指し、`site` の note は画像のタグを出さない（サイト共通の 1200×630 の画像を引き継がない） | W（既定・CHECK・migration 0024 の行の変換）・結（タグ・原本のバイト・トップの `summary_large_image`） |
| FR-027 | 行に URL だけを書いた行を見分け、文の中の URL を見分けない。題を持つ URL はカードで、持たない URL はリンクで出す | 単（見分けとカード）・結（訪問者と見た目の確認の応答） |
| FR-028・SC-005・User Story 6 の 2 | 表示のたびに参照先へ取りに行かない。訪問者の表示の前後で `link_preview` の行の数が変わらない | 結 |
| U9 の決定 | 見た目の確認が、参照先の情報を持たない URL だけを取って書き、取れない URL は書かずにリンクで出す。取得の部品が上限と内部のアドレスの拒否を守る | 単（ユースケースと取得の部品）・W（workerd の `Response`・文字コード・中止の合図）・結（見た目の確認の応答） |
| FR-029・FR-030・User Story 6 の 3 | 参照先の情報は URL ごとに 1 つで、取り直すと同じ行が変わる。画像は URL だけ | W |
| FR-031・FR-032・User Story 7 | 転載先を 2 つ記録でき、同じ URL を別の note に記録できない | W・E |
| FR-033 | オーナーでない呼び出しが何も書かない | 結 |
| U4 の決定 | 本文の Markdown が要素になり、本文に書いた HTML は要素にならない。画像の印が画像の部品になり、題の欄がホバーで出す文に、すぐ下の行の `*…*` がキャプションになる。説明文が空なら最初の段落が説明に出る | 単（本文の読み方）・結（応答） |
| REQUIREMENTS.md の FR-11 | 完全に消す（FR-017 と同じ検査） | W |
| REQUIREMENTS.md の FR-13 | 見た目の確認の画面が最も新しい版を訪問者向けの部品で出す | 結 |
| REQUIREMENTS.md の FR-14 | 書きかけの保持（FR-018 と同じ検査） | E |
| ADR-0051 | 管理画面のリンク・303 の行き先・隠しフィールドに数字だけの識別子が無い | 結 |

## 参照先への取得の上限

constitution II と `docs/SOFTWARE_DESIGN.md` の原則 2 が求める上限の値（research.md の R13）。値は `src/shared/server/link-preview-fetch.ts` の `LINK_PREVIEW_LIMITS` が持ち、`tests/unit/link-preview-fetch.test.ts` が確かめる。2026-11-10 に PM が承認した。

| 項目 | 値 | 根拠 |
|---|---|---|
| 1 回の見た目の確認で取る URL の数 | 5。超えた分は次に開いたときに取る | Workers Free の 1 回の呼び出しの subrequest は 50 で、リダイレクトの各段も数える。同時に応答を待てる接続は 6（[Workers の Limits](https://developers.cloudflare.com/workers/platform/limits/)）。5 件を並べて取る |
| 1 つの URL で辿るリダイレクト | 2 段。外への要求は 1 回の見た目の確認で最大 15 | 同上 |
| 1 つの URL の待ち時間 | 3 秒（リダイレクトと本文の読み込みを含む） | オーナーが画面の表示を待つため秒の単位に抑える。並べて取るため、画面の待ちは最大でおよそ 3 秒 |
| 1 本の応答から読む大きさ | 512 KiB。`</head>` まで読んだら残りを読まない | Workers Free の CPU 時間は 1 回の要求で 10 ms（同上）。読む値は `<head>` の中にある（[The Open Graph protocol](https://ogp.me/)） |
| 読む応答 | 2xx の `text/html` と `application/xhtml+xml`。ほかの形式は題も画像も無い取得にする | 同上 |
| 読む値 | 題は `og:title`・`twitter:title`・`<title>` の順、画像は `og:image`・`twitter:image` の順。題は 200 文字で切る。画像の URL はページの URL で絶対にし、http か https で 2,048 文字までだけを持つ | The Open Graph protocol。題の長さは note の題（FR-005）と揃える |
| 要求を出さない URL | http・https 以外、既定でないポート、資格情報つき、ホストが IP の文字列、点の無い名前、`localhost`・`.localhost`・`.local`・`.internal`・`.home.arpa`・`.invalid`・`.test`。リダイレクトは自動で辿らず、行き先ごとに同じ検査を通す | [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) の Case 2。名前を引いた後のアドレスは Workers で確かめられないため、`wrangler.jsonc` の `global_fetch_strictly_public`（要求を公開のインターネットから出したものとして送る、[Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)）に任せる |

## 未決

この plan では決めない。止めるタスクは tasks.md が「止める未決: U<n>」で示す。U4・U5 は 001 の plan.md の U4・U5 と同じ項目で、001・003 が同じ決定を使う。

| ID | 未決 | 決める人・場所 | 止める範囲 |
|---|---|---|---|
| U1 | D1 の表から TypeScript の型を作る方法（#188） | #188 | 無し（001 の U1 と同じ） |
| U2 | 訪問者の note の URL の形。plan は ADR-0048（コレクション名と識別子、`/notes` を切れば一覧）から `/notes/{slug}` と導いた。spec は未決とする | オーナー（確認） | 無し。覆れば経路のタスクを直す |
| U3 | 識別子の候補を題から示すか（ADR-0048 は示すとし、spec は未決とする） | オーナー | 無し。決まるまで候補を示さない |
| U4 | 決定済み（2026-11-09、オーナー）。本文は Markdown で、生の HTML を通さない。画像は `media.storage_key` で指し（2026-11-09、PM。主キーは ADR-0051 によりフォームに出さない）、キャプションを添える。キャプションは Zenn の書き方（画像のすぐ下の行の `*…*`）で書き、題の欄はホバーで出す文にする（2026-11-10、オーナー）。URL カードは行に URL だけを書く。印の書き方と共有担当の部品は research.md の R11 | — | 無し |
| U5 | 決定済み（2026-11-09、オーナーから任されて Claude が決めた。001 と共有）。R2 の原本を Worker が確かめて変換せずに返し、公開していない画像は `no-store`。JPEG・PNG・WebP・GIF、1 枚 10 MB まで（research.md の R12） | — | 無し |
| U6 | 公開の操作でも、保存と同じく編集を始めたときの版と比べるか | オーナー | 無し。決まるまで比べず、その時点の最も新しい版を公開する（FR-011） |
| U7 | 保存を止めたあと、オーナーが内容を合わせる手順。前の版の書きかけの見せ方は決定済み（2026-11-10、オーナーから任されて Claude が決めた）: 開き直した編集の画面で知らせ、戻す・捨てるを選ばせる。戻す範囲も決定済み（2026-11-10、同じ）: 書きかけで変えた項目だけを戻す（research.md の R10） | オーナー | 無し。決まるまで、知らせて入力を残し、開き直したら前の版の書きかけを知らせる（FR-020） |
| U8 | 決定済み（2026-11-10、オーナー。[issue #219 の U8 の報告](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6766846712)）。題を入れて自動で作る画像を持たず、代表画像の出どころから `generated` を外す。note のページは小さい画像の隣に文字が並ぶカード（`twitter:card` を `summary`）にする。`media` の画像は縮めない。`site` の画像（note 用のサイト共通の 400×400 の画像）はオーナーが用意するまで出さない。サイト共通の 1200×630 の画像とサイト全体の設定は変えない（research.md の R12、[ADR-0053](../../docs/decisions/0053-machine-readers-with-small-note-card.md)） | オーナー（`site` の画像を用意する。#294） | `site` の note のカードの画像だけ。決まるまで画像を付けない |
| U9 | 決定済み（2026-11-10、オーナー）。参照先の情報は、見た目の確認の画面（`/dash/notes/{uid}/preview`、保存した最も新しい版）を開いたときに、持たない URL だけを取る。定期実行で取り直さず、書きかけを即時に描くプレビューは作らない。取れなかった URL は URL の文字列のリンクで出す（2026-11-10、オーナー）。カードの画像の出し方は 2026-11-10 に PM が承認した。本文から消えた URL の行は消さずに残す（2026-11-10、オーナー。行は複数の note が共有し（FR-029）、完全に消す処理も残す（FR-017・R6）。量は測ってから決める（原則 6・9））。spec.md の Clarifications と research.md の R13 | — | 無し |
| U10 | 削除した note の URL を訪問者が開いたときの応答 | オーナー | 無し。決まるまで無い識別子と同じ 404 |
| U11 | 転載先の URL を訪問者に見せるか | オーナー | 無し。決まるまで DTO に入れない |
| U12 | 公開の操作のあと、訪問者に見えるまでの時機とキャッシュの扱い | オーナー | 無し。キャッシュを使わず、次の要求から見える |
| U13 | note の更新日（初めて公開した日とは別の日付）をどこに持つか | オーナー | 無し。訪問者に更新日を出さない |
| U14 | 本文から消した画像のデータを残すか、画像の置き場と保管するデータのずれの扱い | オーナー | 無し。決まるまで残し、訪問者には出さない（research.md の R12） |

決定済み: 同時編集で比べる値は最も新しい版（2026-11-09、オーナー。spec の FR-020・FR-021・Assumptions、research.md の R4）。本文の書式（U4）と画像（U5）は上の表。

依存（未決ではない）: 共有担当の migration（`note.uid`・`note_revision.uid`）、書きかけの保持の部品（001 の T072）、slug の形の検査、Markdown の部品（research.md の R11）。`src/proxy.ts` は 001・002 の作業者も直すため、003 の変更は既にある分岐を変えずに足す。

## Project Structure

### Documentation (this feature)

```text
specs/003-note/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── visitor-note.md
│   └── dash.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

ADR-0026 のディレクトリの形と依存の向きに従う。機能どうしは import しない。

```text
src/
├── proxy.ts                         /notes/:slug の 404、/dash/notes/* の 404、matcher に /notes/:slug/media/:key を足す
├── app/
│   ├── notes/[slug]/page.tsx        note のページ（訪問者）
│   ├── notes/[slug]/missing/page.tsx
│   ├── notes/[slug]/media/[key]/route.ts   note の画像（訪問者）
│   └── dash/
│       ├── page.tsx                 note の一覧へのリンクを足す
│       └── notes/
│           page.tsx・new/page.tsx・[id]/page.tsx・[id]/missing/page.tsx・[id]/preview/page.tsx・
│           [id]/delete/page.tsx・[id]/revisions/page.tsx・
│           [id]/revisions/[revisionId]/page.tsx・[id]/revisions/[revisionId]/missing/page.tsx
└── features/
    └── note/
        ├── domain/       note.ts・note-repository.ts
        ├── application/  deps.ts・create-note.ts・save-note.ts・revert-note.ts・publish-note.ts・
        │                 unpublish-note.ts・delete-note.ts・restore-note.ts・change-note-card-image.ts・
        │                 add-note-syndication.ts・remove-note-syndication.ts・add-note-media.ts・get-visitor-note-media.ts・
        │                 get-visitor-note.ts・get-note-for-edit.ts・list-notes.ts・list-note-revisions.ts
        ├── components/   note-form.tsx・note-status-form.tsx・note-card-image-form.tsx・
        │                 note-syndication-form.tsx・note-revision-list.tsx・visitor-note.tsx・link-card.tsx
        └── server/       d1-note-repository.ts・queries.ts・actions.ts

tests/
├── unit/          note の domain と application・proxy
├── workers/       note の Repository の実装（本物の migrations/ を当てる）
├── integration/   /notes/* と /dash/notes の応答
├── e2e/           オーナーの操作（スマートフォンの端末の設定を含む）
└── support/       note-rows.ts
```

**Structure Decision**: 1 つの Next.js のプロジェクトに置く（ADR-0026）。`src/features/note/server/` が組み立て用の関数（`queries.ts`）と Server Action（`actions.ts`）を持ち、`page.tsx`・`src/proxy.ts` はそれを呼ぶ（ADR-0030・ADR-0040）。

## Complexity Tracking

constitution に反するものは無い。
