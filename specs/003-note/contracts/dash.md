# Contract: note の管理画面と書き込みの操作

## 共通

001 の [contracts/dash.md](../../001-career-and-project/contracts/dash.md) の「共通」に従う（`src/proxy.ts` の 403 と `no-store`、ページと Server Action の先頭でのオーナーの確認、`<form action={Server Action}>`、失敗の結果は項目ごとの理由と送られた値、uid で開くことと無い uid の 404）。結果の型は `src/shared/domain/action-result.ts` の `ActionResult` を使う。

003 で足すこと:

- 保存と過去の版に戻すは、開いたときの最も新しい版の uid を隠しフィールドで送る。その note の最も新しい版と違えば何も書かず、`conflict` の結果で送られた値を返す（FR-020、research.md の R4）。比べるのは版で、`note.updated_at` は送らない
- 失敗の理由の「無い・削除した」「戻す版がその note に無い」「その note の転載先に無い」は `ActionResult` に入れず、ユースケースの `not-found` として返し、Server Action は一覧（`/dash/notes`）へ 303 で移す。001 の `editProject` と同じ形（`src/features/project/server/actions.ts`）
- 公開・下書きに戻す・削除・元に戻す・代表画像の出どころ・転載先の操作は、開いたときの版を送らない（research.md の R5。公開でも比べるかは plan.md の U6）
- 削除した note の画面も `/dash/notes/{uid}` で開ける。削除した note の画面は、中身を読み取りだけで出し、「元に戻す」だけを置く
- 過去の版の画面（`/dash/notes/{uid}/revisions/{revisionUid}`）は、版が無いか、その note に属さなければ `src/proxy.ts` が `/dash/notes/{uid}/revisions/{revisionUid}/missing` へ rewrite する（404）
- 編集の画面は、共有担当の `DraftRetainingForm`（`src/shared/components/draft-retention.tsx`）で、書きかけの内容をその端末に持つ。`version` に開いた版の uid を渡す。部品は送信で消し、`saved` 以外の結果（`conflict` を含む）が返ると送った値を持ち直す（research.md の R10）

## 画面

| 経路 | 中身 | 要件 |
|---|---|---|
| `/dash` | note の一覧への入口を足す | — |
| `/dash/notes` | note の一覧。最も新しい版の題・識別子・状態・削除したか。削除した note も出す | FR-001・FR-016 |
| `/dash/notes/new` | 作成。識別子・題・説明文・本文 | FR-001・FR-002・FR-005 |
| `/dash/notes/{uid}` | 編集。識別子（一度でも公開したら読み取りだけ）・題・説明文・本文・開いた版の uid。公開・下書きに戻すの操作、代表画像の出どころ、転載先の一覧と足す・外す、版の一覧・見た目の確認・削除へのリンク。保存を止めたときの知らせ | FR-003・FR-005〜FR-007・FR-011・FR-014・FR-020・FR-021・FR-024・FR-031 |
| `/dash/notes/{uid}/revisions` | 版の一覧。保存した日時の新しい順。最も新しい版に印。公開した版の印は note が公開で削除していないときだけ付ける | FR-008・FR-014・FR-016 |
| `/dash/notes/{uid}/revisions/{revisionUid}` | 過去の版の題・説明文・本文（保存したときのまま）と「この版に戻す」 | FR-008・FR-009 |
| `/dash/notes/{uid}/preview` | 最も新しい版を訪問者に見せたときの見た目。訪問者向けと同じ部品で描く。状態と削除に関わらず出す | REQUIREMENTS.md の FR-13 |
| `/dash/notes/{uid}/delete` | 削除の確認 | FR-016 |

画像の追加は編集の画面に置き、足した画像を本文に貼る印（`![代替テキスト](media:<storageKey> "キャプション")`。`storageKey` は `media.storage_key`。主キーは出さない）を示す。代表画像の出どころの入力は、`generated`・`site`・その note の画像から選ぶ。 <!-- check-ignore: 本文の画像の記法の例 -->

## Server Action

| 名前 | 入力 | 成功 | 失敗の理由 |
|---|---|---|---|
| `createNote` | 識別子・題・説明文・本文 | 編集の画面へ 303 | オーナーでない／項目の不備（識別子の形・重複、題・本文の長さ） |
| `saveNote` | uid・開いた版の uid・識別子・題・説明文・本文 | 新しい版を足し、同じ画面へ 303 | オーナーでない／項目の不備／公開したことのある note の識別子の書き換え／先に保存されていた（`conflict`）／無い・削除した |
| `revertNote` | uid・開いた版の uid・戻す版の uid | 戻す版の中身を新しい版として足し、編集の画面へ 303 | オーナーでない／先に保存されていた／戻す版がその note に無い／無い・削除した |
| `publishNote` | uid | 最も新しい版を公開した版にし、同じ画面へ 303 | オーナーでない／題が空（項目で知らせる）／無い・削除した |
| `unpublishNote` | uid | 下書きに戻し、同じ画面へ 303 | オーナーでない／無い・削除した |
| `deleteNote` | uid | 削除済みの印を付け、一覧へ 303 | オーナーでない／無い |
| `restoreNote` | uid | 削除済みの印を外し、編集の画面へ 303 | オーナーでない／無い |
| `changeNoteCardImage` | uid・出どころ（`generated`・`site`・`media`）・`media` のときは画像の key | 同じ画面へ 303 | オーナーでない／その note の画像でない／無い・削除した |
| `addNoteMedia` | uid・画像のファイル | `media` に足し、同じ画面へ 303 | オーナーでない／JPEG・PNG・WebP・GIF でない／10 MB を超える／無い・削除した |
| `addNoteSyndication` | uid・転載先の URL | 同じ画面へ 303 | オーナーでない／http か https でない／既に記録した URL（同じ note か別の note）／無い・削除した |
| `removeNoteSyndication` | uid・転載先の URL | 同じ画面へ 303 | オーナーでない／その note の転載先に無い |

## 検査

- 結合: JWT のない `/dash/notes/*` の GET が 403 で、`no-store` を持つ
- 結合: JWT のない各 Server Action の呼び出しが 403 の結果を返し、D1 の行が変わらない（FR-033、constitution I）
- 結合: 管理画面のリンク・303 の行き先・隠しフィールドに数字だけの識別子が出ない（ADR-0051、`tests/integration/dash-url-without-id.test.ts` に足す）
- E2E: オーナーとして、作成・保存・公開・下書きに戻す・削除・元に戻す・過去の版に戻すができる。キーボードだけで操作できる（constitution V）
- E2E: 2 つのタブで同じ note を開き、後から保存した側が止まり、知らせが出て、入力が残る。続けて 2 回保存した側は 2 回とも保存される（User Story 4 の 3・4）
- E2E: スマートフォンの端末の設定で、作成・保存・公開を終えられる（FR-022・SC-006）
