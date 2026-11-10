# Data Model: note

表・列・型・CHECK・外部キー・トリガの正本は `migrations/` にある。この文書は、`migrations/0001`〜`0011` と、共有担当が足す note と note_revision の uid の migration を当てたスキーマを、spec の要件と、アプリケーションが守る決まりに対応させる。列の一覧は書き写さない。`migrations/0005_rebuild_note_and_create_media.sql` の注釈が指す `specs/005-note-write-and-read` の要件番号は、この spec の番号と違う。対応は下の「0005 の注釈の要件番号」が持つ。

## Contents

- 表と spec の対応
- スキーマが守る決まり
- アプリケーションが守る決まり
- 状態の移り変わり
- domain の型
- 訪問者向けの DTO
- 0005 の注釈の要件番号

---

## 表と spec の対応

| 表 | spec の実体 | 003 が書くか | 主な要件 |
|---|---|---|---|
| `note` | note | 書く | FR-001〜FR-004、FR-010〜FR-016、FR-024・FR-025、FR-034 |
| `note_revision` | 版 | 足すだけ（書き換えない） | FR-005〜FR-009、FR-012、FR-020・FR-021 |
| `media`（`note_id` を持つ行） | 画像 | 書く | FR-023〜FR-026 |
| `link_preview` | 参照先の情報 | 書く（取得は U9 が解けてから） | FR-027〜FR-030 |
| `syndication` | 転載先 | 書く | FR-031・FR-032 |

`media` の `project_id`・`career_id`・`activity_id` の行は 001・004 が持つ。003 は読まず、書かない。

共有担当の migration で足す列: `note.uid`、`note_revision.uid`（research.md の R1）。管理画面の URL とフォームは、この 2 つで行を指す。

## スキーマが守る決まり

003 のコードで重ねて書かない。アプリケーションは、項目ごとに知らせるために保存の前にも確かめ、スキーマの制約を最後の守りとして残す。

| 決まり | スキーマ | 要件 |
|---|---|---|
| 識別子の形と重複（削除した note を含む） | `note.slug` の CHECK と UNIQUE | FR-002 |
| 公開した note の識別子を変えない | トリガ `note_slug_fixed_after_publication` | FR-003 |
| 作った note は下書き | `note.status` の DEFAULT `draft` | FR-001 |
| 状態は下書きか公開 | `note.status` の CHECK | FR-010 |
| 題は 200 文字まで、本文は 100,000 文字まで | `note_revision.title`・`body` の CHECK | FR-005 |
| 版を書き換えない | トリガ `note_revision_immutable` | FR-006 |
| 公開する版は同じ note の、題が空でない版 | トリガ `note_published_revision_valid`、複合の外部キー | FR-011 |
| 公開の note は公開した版を持つ | `note` の CHECK | FR-011・FR-012 |
| 初めて公開した日時を変えない | トリガ `note_published_at_fixed` | FR-013 |
| 代表画像の出どころは 3 つのどれか、既定は自動で作る画像 | `note.card_image` の CHECK と DEFAULT | FR-024 |
| 説明文が空のときに本文の最初の段落を使うかは 0 か 1、既定は 1 | `note.is_first_paragraph_as_description` の CHECK と DEFAULT（`migrations/0023`） | FR-034 |
| 代表画像の画像はその note の画像だけ | `note` の複合の外部キー `(id, card_media_id)` | FR-025 |
| 画像の持ち主は 1 つだけ | `media` の CHECK | spec の Key Entities |
| 参照先の情報は URL ごとに 1 つ | `link_preview.url` の UNIQUE | FR-029 |
| 同じ転載先の URL を 2 つ以上記録しない | `syndication.url` の UNIQUE | FR-032 |
| 管理画面の URL の識別子は作った後に変えない | 共有担当の migration のトリガ | ADR-0051 |

## アプリケーションが守る決まり

| 決まり | 要件 | 置き場 |
|---|---|---|
| 識別子の形 | FR-002 | 共有担当の `src/shared/domain/slug.ts`（`isSlug`） |
| 一度でも公開した note の識別子の書き換えを、保存の前に拒む | FR-003 | `src/features/note/domain/note.ts` |
| 題が空の版の公開を、書く前に拒み、項目で知らせる | FR-011 | `src/features/note/application/publish-note.ts` |
| 説明文は空にでき、空の値は NULL で持つ | FR-005 | `src/features/note/domain/note.ts`（`src/shared/domain/empty-to-null.ts`） |
| 説明は説明文。空なら、本文の最初の段落を使う note だけが段落を使う | FR-034 | `src/features/note/domain/note.ts`（`summaryOf`） |
| 保存は開いたときの最も新しい版と比べ、違えば書かない | FR-020・FR-021 | `src/features/note/server/d1-note-repository.ts`（research.md の R4） |
| 訪問者には、公開で削除していない note の、公開した版だけを出す | FR-012・FR-015・FR-016 | 同上（research.md の R7） |
| 転載先の URL は http か https | FR-031 | `src/shared/domain/web-url.ts` |
| オーナーでない呼び出しは何も書かない | FR-033 | 各ユースケースの先頭（`src/shared/server/author.ts`） |

## 状態の移り変わり

`note` の行が持つ値の組で表す。`published_at` を持つことが「一度でも公開した」を表す。

| 状態 | `status` | `published_at` | `deleted_at` | 訪問者 |
|---|---|---|---|---|
| 一度も公開していない下書き | `draft` | NULL | NULL | 出さない |
| 公開 | `published` | あり | NULL | 公開した版を出す |
| 下書きに戻した | `draft` | あり | NULL | 出さない |
| 削除した（上のどれか） | 削除前のまま | 削除前のまま | あり | 出さない |

| 操作 | 書くもの | 書かないもの | 要件 |
|---|---|---|---|
| 作る | `note` の行と 1 つ目の版 | — | FR-001 |
| 保存 | 新しい版（識別子を変えるときは `slug`） | 公開した版 | FR-006・FR-012 |
| 過去の版に戻す | 戻す版の中身を新しい版として | 公開した版 | FR-009 |
| 公開 | `status`、`published_revision_id`（最も新しい版）、`published_at`（空のときだけ） | — | FR-011・FR-013 |
| 下書きに戻す | `status` | `published_revision_id`・`published_at` | FR-014 |
| 説明文が空のときに本文の最初の段落を使うかを変える | `is_first_paragraph_as_description` | 版 | FR-034 |
| 削除 | `deleted_at` | `status`・版 | FR-016 |
| 元に戻す | `deleted_at` を NULL | `status`・版 | FR-016・SC-007 |
| 完全に消す | `media`・`syndication`・`note_revision`・`note` を消す | `link_preview` | FR-017（画面は作らない） |

削除した note に対する保存・公開・下書きに戻すは、Repository が `deleted_at IS NULL` を条件にして書かず、`not-found` を返す。

## domain の型

`src/features/note/domain/note.ts` に置く。

- `NoteId`（主キー。URL とフォームに出さない）、`Uid`（`src/shared/domain/uid.ts`）
- `NoteStatus`: `as const` の配列 `['draft', 'published']`。`note.status` の CHECK と同じ値を 1 か所に置く（001 の research.md の R3）
- `NoteCardImage`: `as const` の配列 `['generated', 'media', 'site']`
- `NoteRevisionContent`: 題・説明文（空なら null）・本文
- `NoteRevision`: uid・`NoteRevisionContent`・保存した日時
- `Note`（オーナーが編集する形）: uid・識別子・状態・一度でも公開したか・初めて公開した日時・削除した日時・代表画像の出どころ・説明文が空のときに本文の最初の段落を説明に使うか・最も新しい版・転載先の URL の並び
- `NoteSummary`（オーナーの一覧）: uid・識別子・最も新しい版の題・状態・削除したか・作った日時
- `NoteFormValues`・`NoteField`・`NoteFieldError`: 入力の項目と誤りの理由（001 の `ProjectFormValues` と同じ形）

## 訪問者向けの DTO

出す項目は [contracts/visitor-note.md](./contracts/visitor-note.md) が列挙する。最も新しい版・削除した日時・下書きに戻したことがあるか・転載先・uid は持たない。

## 0005 の注釈の要件番号

0005 の注釈が指す `specs/005-note-write-and-read` の番号と、この spec の番号の対応。

| 0005 の注釈 | 指す決まり | この spec |
|---|---|---|
| FR-004 | 初めて公開した日時を変えない | FR-013 |
| FR-006 | 削除した note の識別子を別の note に渡さない | FR-002 |
| FR-007 | 公開した note の識別子を変えない | FR-003 |
| FR-018 | 下書きに戻しても公開した版を残す | FR-014 |
| FR-021 | 版を書き換えない | FR-006 |
