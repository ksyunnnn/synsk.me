# Implementation Plan: note

**Branch**: `feature/209-note` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-note/spec.md`

## Contents

- Summary
- Technical Context
- Constitution Check
- 要件と検査の対応
- 未決
- Project Structure
- Complexity Tracking

## Summary

オーナーが管理画面（`/dash/notes`）で note を作り、保存のたびに版を足し、公開・下書きに戻す・削除・削除を戻す・過去の版に戻すを行う。訪問者は `/notes/{slug}` で、公開で削除していない note の公開した版だけを読む。版の保存と公開は、開いたときの版の番号と比べて衝突を止める（列を足さない）。本文は Markdown で、生の HTML を描かない。画像は R2 に置き、サイトを通して、公開した版が指す画像と代表画像だけを訪問者に返す。本文の URL だけの段落は、保存のときに取った参照先の情報でカードにする。転載先の URL を記録する。管理画面の URL に出す `note.uid` を migration 0015 で足す。

## Technical Context

**Language/Version**: TypeScript 6.0（`typescript` ~6.0.3）、Node.js 22 以上

**Primary Dependencies**: vinext 1.2（Next.js 16.4.2 の App Router・Server Components・Server Actions・Cache Components）、React 19.3、`jose`、Tailwind CSS 4、`next/og`（代表画像）、`react-markdown` 10.1.0（本文の描画。research.md の R6 で足す）

**Storage**: Cloudflare D1（binding `DB`）。`migrations/0005_rebuild_note_and_create_media.sql` の表と、`migrations/0015_add_uid_to_note.sql`（research.md の R1）。画像は R2（binding `NOTE_IMAGES`）

**Testing**: Vitest（単体）、`@cloudflare/vitest-plugin`（workerd・D1・R2）、`createTestHarness()`（本番ビルドに対する結合）、Playwright（E2E）。ADR-0019 の 4 段階

**Target Platform**: Cloudflare Workers

**Project Type**: Web アプリケーション（1 つの Next.js のプロジェクト）

**Performance Goals**: 訪問者が到達する `/notes/{slug}` が `docs/REQUIREMENTS.md` の NFR-03〜NFR-07 を満たす。判定はフィールドの計測（ADR-0017）

**Constraints**: 応答は NFR-08・NFR-09 を満たす。`/dash` と画像の応答は `no-store`。PR の CI は 10 分以内。画像は 1 枚 5 MB・1 つの note に 30 枚、参照先の取得は 1 回の操作で 10 個・1 つ 5 秒・512 KB（research.md の R7・R9）

**Scale/Scope**: 書き手はオーナー 1 人。管理画面は 7 種類の画面、訪問者の経路は note のページ・画像・代表画像の 3 つ

## Constitution Check

*GATE: Phase 0 の前と、Phase 1 の設計の後に判定した。結果はどちらも同じ。*

| 原則・制約 | 判定 | 根拠 |
|---|---|---|
| I. Protected Values | 通る | 訪問者向けの取り出しは公開した版の列だけを SELECT し、最新の版・下書き・削除した note を読まない（[contracts/visitor-note.md](./contracts/visitor-note.md)）。画像は配る条件を Repository の実装の中で確かめる（R7）。書き込みの Server Action は先頭でオーナーを確かめ、オーナーでない呼び出しが何も書かないことを結合で確かめる（[contracts/dash.md](./contracts/dash.md)） |
| II. Stop on Missing Input | 通る | 公開は、題が空の版と、開いた後に保存された版で止める（R4）。費用のかかる処理は画像の追加と参照先の取得で、上限の値を書いた（R7・R9） |
| III. Verified Scope | 通る | 要件と検査の対応は下の表。完全に消す画面は spec の範囲の外 |
| IV. Partial Availability | 通る | 参照先の情報が取れない URL は、カードにせずリンクで出し、保存を止めない（R9）。代表画像の書体が取れなければ題を入れずに描く（R8）。画面は NFR-02 の状態（データが無い＝404、エラー＝500 の画面）で成立する |
| V. Accessible Controls | 通る | 入力はネイティブの要素と `<form>`。E2E でキーボードだけとスマートフォンの幅の操作を確かめる |
| VI. Measure Before Optimizing | 通る | キャッシュ・索引の追加・版の圧縮を含めない（spec の Assumptions「版が増えたときの扱いは、閾値を割ってから決める」） |
| VII. Boundary Translation | 通る | 参照先の HTML は `src/features/note/server/link-preview-fetcher.ts` の中で `{ title, imageUrl }` に詰め替える。D1 の行は Repository の実装の中で domain の型に詰め替える |
| VIII. Portable Core | 通る | D1 は `src/features/note/server/d1-note-repository.ts`、R2 は `src/shared/server/media-storage.ts`、`HTMLRewriter` は `link-preview-fetcher.ts`、`cloudflare:workers` の env は `src/shared/server/env.ts` だけで使う |
| IX. Simplicity | 通る | `src/shared/server/media-storage.ts` の 2 つ目の使い手は、001 の実績・職歴の画像（001 の research.md の R14）。Repository のインタフェースの 2 つ目の使い手は、単体の検査の作り物の実装（ADR-0026 のルール 2） |
| Test Layering | 通る | 同じことを 2 つの段階で確かめない（下の表の「段階」） |
| Display Speed | 通る | note のページは NFR-03〜NFR-07 の対象。判定はフィールドの計測で、CI では判定しない |
| Cacheability | 通る | `'use cache'`・`revalidate`・`dynamic` を書かない。404 と 403 は `src/proxy.ts` が決める（R12） |
| Allowlist Visibility | 通る | 訪問者向けの DTO が出す項目を列挙する（contracts/visitor-note.md） |

## 要件と検査の対応

段階: 単＝単体、W＝workerd、結＝結合、E＝E2E。

| 要件 | 検査 | 段階 |
|---|---|---|
| FR-001・FR-005 | 作った note が下書きで版を 1 つ持つ。題 200・本文 100,000 文字を超える入力を拒む | 単（入力）・W（作成） |
| FR-002 | 識別子の形、削除した note を含む重複を拒む | 単・W |
| FR-003・User Story 1 の 6 | 公開した note の識別子を変えられない、下書きのうちは変えられる | W |
| FR-004 | `/notes/{slug}` が公開の note を返し、URL に連番を出さない | 結 |
| FR-006〜FR-008・SC-003 | 保存のたびに版が増え、過去の版が保存したときのまま読める | W |
| FR-009・User Story 3 | 過去の版に戻すと写しが新しい版になり、公開した版は変わらない | W |
| FR-010〜FR-013・SC-004 | 公開・公開し直し・下書きに戻すで、公開した版と初めて公開した日時の移り方 | W |
| FR-012・FR-014・FR-015・FR-016・SC-001 | 下書き・削除・公開後に保存した版が応答に無い | 結 |
| FR-016・SC-007 | 削除して戻すと状態と版と識別子が戻る | W |
| FR-017 | 完全に消すと note・版・画像・転載先が残らず、参照先の情報は残る | W |
| FR-018・FR-019・User Story 4 の 1・2 | 書きかけが同じ端末に残り、保存すると消える | E |
| FR-020・FR-021・SC-002 | 開いた後に保存されていれば止まり、内容が残る。続けて 2 回保存できる | W（判定）・E（内容が残る） |
| FR-022・SC-006 | スマートフォンの幅で作って公開できる | E |
| FR-023・FR-026・User Story 5 の 1・4・5 | 画像の追加と、配る条件 | 単（形式と上限）・W（条件）・結（404） |
| FR-024・FR-025・User Story 5 の 2・3 | 代表画像の既定が自動で作る画像、ほかの note の画像を選べない | W・結（`og:image`） |
| FR-027〜FR-030・SC-005 | カードにする URL の取り出し、HTML の読み取り、表示で取りに行かない、URL ごとに 1 つ | 単・W・結 |
| FR-031・FR-032 | 転載先を 2 つ記録でき、同じ URL を別の note に記録できない | W |
| FR-033 | オーナーでない呼び出しが何も書かない | 結 |
| REQUIREMENTS.md の FR-13 | プレビューが最新の版を出す | 結 |

## 未決

この plan では決めない。spec の「決定が無く、この spec では決めない」の項目には、止めずに進めるための既定を置いた。オーナーが覆せば、research.md の該当の項目と tasks.md を直す。

| ID | 未決 | 既定（実装者、2026-11-09） | 根拠 | 決める人 |
|---|---|---|---|---|
| U1 | 識別子の候補を題から示すか | 示さない。オーナーが入れる | research.md の R15 | オーナー |
| U2 | 訪問者の note の URL の形 | `/notes/{slug}` | ADR-0016、R3 | オーナー |
| U3 | 削除した note の URL を訪問者が開いたときの応答 | 無い識別子と同じ 404 | 設計原則 1、R12 | オーナー |
| U4 | 公開の操作でも編集を始めたときの版と比べるか | 比べ、違えば公開しない | 設計原則 2、R4 | オーナー |
| U5 | 保存を止めたあと内容を合わせる手順 | 止めた画面の内容を残し、最新の版を別のタブで開くリンクを示す。自動で合わせない | R4 | オーナー |
| U6 | 公開のあと訪問者に見えるまでの時機とキャッシュ | 次の要求から見える。キャッシュしない | constitution VI、R12 | オーナー |
| U7 | 参照先の情報を取り直す時機と、本文から消えた URL の情報 | 保存のときに無い URL だけ取り、取り直しはオーナーの操作。消えた URL の情報は残す | R9 | オーナー |
| U8 | 参照先の情報が取れなかった URL の見せ方 | カードにせず URL の文字のリンク | 設計原則 4、R9 | オーナー |
| U9 | 本文のどの URL をカードにするか | URL 1 つだけの段落 | R9 | オーナー |
| U10 | カードの画像の出し方（#186） | 参照先の `https` の画像の URL をそのまま指す。`no-referrer`・`lazy` | FR-030、R9 | #186 |
| U11 | note の更新日をどこに持つか（#150） | 持たず、出さない | R14 | #150 |
| U12 | 本文から消した画像のデータを残すか、画像の形式と大きさの上限 | 残す。JPEG・PNG・WebP・GIF、1 枚 5 MB、1 つの note に 30 枚 | FR-009、constitution II、R7 | オーナー |
| U13 | 転載先の URL を訪問者に見せるか | 見せない | 設計原則 3、R10 | オーナー |
| U14 | 画像の置き場と保管するデータのずれ | `media` を正とし、行の無い R2 の物は配らない。直す処理は持たない | R7 | オーナー |
| U15 | 書きかけの保持の部品を 001 の T072 の部品とまとめるか | note に固有の部品として置く | R11 | 実装者（001 の T072 の後） |

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
migrations/0015_add_uid_to_note.sql
src/
├── proxy.ts                          /notes/:slug の 404、/dash/notes/{uid} と版の番号の 404 を足す
├── app/
│   ├── notes/[slug]/page.tsx         note のページ（訪問者）
│   ├── notes/[slug]/missing/page.tsx
│   ├── notes/[slug]/images/[file]/route.ts
│   ├── notes/[slug]/card-image/route.tsx
│   └── dash/notes/
│       ├── page.tsx・new/page.tsx
│       └── [id]/page.tsx・preview/page.tsx・delete/page.tsx・missing/page.tsx
│           ・revisions/page.tsx・revisions/[number]/page.tsx・revisions/[number]/missing/page.tsx
│           ・images/[file]/route.ts
├── features/note/
│   ├── domain/       note.ts・note-repository.ts・note-image.ts・link-card.ts
│   ├── application/  ユースケースを 1 つ 1 ファイル
│   ├── components/   フォーム・本文の描画・書きかけの保持
│   └── server/       d1-note-repository.ts・link-preview-fetcher.ts・queries.ts・actions.ts
└── shared/server/media-storage.ts    R2 の読み書き

tests/
├── unit/          note の domain と application、link-card、link-preview の読み取り、proxy
├── workers/       note の Repository の実装、media-storage、migration 0015
├── integration/   /notes/{slug}・画像・/dash/notes の応答
├── e2e/           オーナーの操作
└── support/       note-rows.ts（作り物の行を入れる道具）
```

**Structure Decision**: 001 と同じく 1 つの Next.js のプロジェクトに置く（ADR-0026）。`server/queries.ts` と `server/actions.ts` が組み立て用の関数と Server Action を持ち、`page.tsx`・route handler・`src/proxy.ts` はそれを呼ぶ（ADR-0030・ADR-0040）。

## Complexity Tracking

constitution に反するものは無い。
