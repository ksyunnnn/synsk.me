# Data Model: note

表・列・型・CHECK・外部キー・トリガの正本は `migrations/` にある。この文書は、`migrations/0005_rebuild_note_and_create_media.sql` と `migrations/0015_add_uid_to_note.sql` を当てたスキーマを、spec の要件と、アプリケーションが守る決まりに対応させる。列の一覧は書き写さない。

## Contents

- 表と spec の対応
- アプリケーションが守る決まり
- 状態の切り替え
- domain の型
- 訪問者向けの DTO

---

## 表と spec の対応

| 表 | spec の実体 | 主な要件 |
|---|---|---|
| `note` | note（識別子・状態・公開した版・初めて公開した日時・削除した日時・代表画像の出どころ・管理画面の uid） | FR-001〜FR-004、FR-010〜FR-016、FR-024 |
| `note_revision` | 版 | FR-005〜FR-009 |
| `media`（`note_id` を持つ行） | 画像 | FR-023・FR-025・FR-026 |
| `syndication` | 転載先 | FR-031・FR-032 |
| `link_preview` | 参照先の情報 | FR-027〜FR-030 |

スキーマが守る決まり（コードで重ねて書かない。保存の前に確かめて画面で知らせるものは除く）: 識別子の形と重複（`note.slug` の CHECK と UNIQUE。削除した note も行が残るため重ならない、FR-002）、公開した note の識別子を変えない（トリガ `note_slug_fixed_after_publication`、FR-003）、版を書き換えない（トリガ `note_revision_immutable`、FR-006）、題 200 文字・本文 100,000 文字（CHECK、FR-005）、初めて公開した日時を変えない（トリガ `note_published_at_fixed`、FR-013）、題が空の版を公開しない（トリガ `note_published_revision_valid`、FR-011）、公開の note は公開した版を持つ（CHECK）、代表画像はその note の画像（複合の外部キー、FR-025）、画像の持ち主は 1 つ（`media` の CHECK）、転載先の URL の重複（`syndication.url` の UNIQUE、FR-032）、参照先の情報は URL ごとに 1 つ（`link_preview.url` の UNIQUE、FR-029）、管理画面の URL の識別子の形・重複・書き換えの拒否（`note.uid`、research.md の R1）。

## アプリケーションが守る決まり

| 決まり | 要件 | 置き場 |
|---|---|---|
| 訪問者に出すのは `status = 'published' AND deleted_at IS NULL` の note の、`published_revision_id` の版だけ | FR-012・FR-015・FR-016 | `src/features/note/server/d1-note-repository.ts` の `VISITOR_VISIBLE` |
| 保存は、開いたときの版の番号と最新の版の番号が一致するときだけ版を足す | FR-020・FR-021 | Repository の実装（research.md の R4） |
| 公開も、開いたときの版の番号と一致するときだけ行う | spec の決定が無い項目 | 同上（research.md の R4 の既定） |
| 削除した note には、戻す操作のほかの書き込みをしない | FR-016 | Repository の実装の条件 `deleted_at IS NULL` |
| 画像の形式・1 枚の大きさ・1 つの note の枚数の上限 | constitution II | `src/features/note/domain/note-image.ts`（research.md の R7） |
| 訪問者に返す画像は、公開した版の本文が指す画像か代表画像 | FR-026 | Repository の実装 |
| 参照先の情報を取りに行く URL の数・時間・大きさの上限 | constitution II | `src/features/note/domain/link-card.ts`・`server/link-preview-fetcher.ts`（research.md の R9） |
| 書きかけの内容は D1 に書かない | FR-018 | `src/features/note/components/`（research.md の R11） |

## 状態の切り替え

| 操作 | 前の状態 | 後の状態 | 変えない値 |
|---|---|---|---|
| 作る | — | `draft`、版 1 つ | — |
| 保存 | 削除していない | 版が 1 つ増える | `status`・`published_revision_id`・`published_at` |
| 公開 | 削除していない、最新の版の題が空でない | `published`、`published_revision_id` = 最新の版 | `published_at`（入っていれば） |
| 下書きに戻す | `published`、削除していない | `draft` | `published_revision_id`・`published_at` |
| 過去の版に戻す | 削除していない | 戻した版の写しが新しい版になる | `status`・`published_revision_id` |
| 削除 | 削除していない | `deleted_at` が入る | `status`・版・`slug` |
| 削除を戻す | 削除した | `deleted_at` が NULL | `status`・版・`slug` |

## domain の型

`src/features/note/domain/note.ts` に置く。

- `NoteForEdit`: uid・識別子・状態・削除したか・初めて公開した日時・公開した版の番号・最新の版の番号と中身・代表画像の出どころと画像のファイル名・画像の一覧・転載先の一覧
- `NoteSummary`: オーナーの一覧の 1 行（uid・識別子・題・状態・削除したか・最新の版の番号・公開した版の番号）
- `NoteRevision`: 番号・題・説明文・本文・作った日時
- `NoteContent`: 保存する題・説明文・本文

## 訪問者向けの DTO

[contracts/visitor-note.md](./contracts/visitor-note.md) が持つ。
