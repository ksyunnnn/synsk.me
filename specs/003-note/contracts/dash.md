# Contract: note の管理画面と書き込みの操作

## 共通

001 の [contracts/dash.md](../../001-career-and-project/contracts/dash.md) の「共通」に従う（オーナーの確認・`no-store`・`<form action={Server Action}>`・失敗の結果・uid で開く）。

## 画面

| 経路 | 中身 | 要件 |
|---|---|---|
| `/dash/notes` | note の一覧（題・識別子・状態・版の番号）と、削除した note の一覧 | FR-001・FR-016 |
| `/dash/notes/new` | 識別子・題・説明文・本文を入れて作る | FR-001・FR-002・FR-005 |
| `/dash/notes/{uid}` | 保存（識別子は一度も公開していない note だけ）、公開・下書きに戻す、画像の追加、代表画像、転載先、参照先の情報の取り直し、削除への入口。削除した note は「削除済み」と戻す操作だけ | FR-003・FR-006〜FR-016・FR-018〜FR-032 |
| `/dash/notes/{uid}/preview` | 最新の版を、訪問者のページと同じ見た目で出す | REQUIREMENTS.md の FR-13 |
| `/dash/notes/{uid}/revisions`、`/dash/notes/{uid}/revisions/{番号}` | 版の一覧、版の中身と「この版に戻す」 | FR-008・FR-009 |
| `/dash/notes/{uid}/delete` | 削除の確認 | FR-016 |
| `/dash/notes/{uid}/images/{file}` | その note の画像（オーナーだけ） | FR-023 |

## Server Action

| 名前 | 入力 | 成功 | 失敗の理由 |
|---|---|---|---|
| `createNote` | 識別子・題・説明文・本文 | 編集の画面へ 303 | オーナーでない／項目の不備／識別子の重複（削除した note を含む） |
| `saveNote` | uid・識別子・題・説明文・本文・開いたときの版の番号 | 同じ画面へ 303（保存した版の番号を添える） | 上に加えて、公開した note の識別子の変更／先に別の画面で保存されていた／削除した note |
| `publishNote` | uid・開いたときの版の番号 | 同じ画面へ 303 | オーナーでない／題が空の版／先に別の画面で保存されていた／削除した note |
| `unpublishNote` | uid | 同じ画面へ 303 | オーナーでない／削除した note |
| `restoreRevision` | uid・戻す版の番号・開いたときの版の番号 | 編集の画面へ 303 | オーナーでない／先に別の画面で保存されていた／削除した note |
| `deleteNote`・`undeleteNote` | uid | 一覧へ 303・編集の画面へ 303 | オーナーでない |
| `addNoteImage` | uid・画像のファイル | 同じ画面へ 303（本文に貼る書き方を示す） | オーナーでない／形式の違い／5 MB を超える／30 枚を超える |
| `chooseCardImage` | uid・出どころ（`generated`・`media`・`site`）・画像のファイル名 | 同じ画面へ 303 | オーナーでない／その note の画像でない |
| `addSyndication`・`removeSyndication` | uid・転載先の URL | 同じ画面へ 303 | オーナーでない／URL の形の違い／同じ URL が記録済み |
| `refreshLinkPreviews` | uid | 同じ画面へ 303（取れた数を添える） | オーナーでない |

## 検査

- 結合: JWT のない `/dash/notes/*` の GET が 403 で、`no-store` を持つ
- 結合: JWT のない各 Server Action の呼び出しが 403 の結果を返し、D1 の行が変わらない（constitution I、FR-033）
- 結合: 管理画面のリンク・redirect 先・隠しフィールドに主キー（数字だけの id）が出ない
- E2E: オーナーとして、作る・保存・公開・下書きに戻す・削除・戻す・過去の版に戻す。2 つの画面の保存の衝突で、後の保存が止まり内容が残る。スマートフォンの幅で作って公開できる。キーボードだけで操作できる
