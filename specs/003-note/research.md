# Research: note

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。spec の「決定が無く、この spec では決めない」の項目に置いた既定は「既定（実装者、2026-11-09）」と書き、plan.md の「未決」の表から指す。オーナーが覆せば、その項目と tasks.md を直す。

## Contents

- R1 スキーマの前提
- R2 001・002 から使うもの
- R3 URL
- R4 版の番号と楽観ロック
- R5 公開・下書き・削除の状態の移り方
- R6 本文の書式と描画
- R7 画像
- R8 代表画像
- R9 URL カード
- R10 転載先
- R11 書きかけの内容の保持
- R12 キャッシュと 404・403
- R13 完全に消す
- R14 更新日
- R15 識別子の候補

---

## R1 スキーマの前提

- 決めたこと: `migrations/0005_rebuild_note_and_create_media.sql` が作った `note`・`note_revision`・`media`・`syndication`・`link_preview` を使う。管理画面の URL に出す `note.uid` を `migrations/0015_add_uid_to_note.sql` で足す。足し方は `migrations/0011_add_uid_for_dash_url.sql` と同じく表を作り直し、行・`sqlite_sequence`・トリガをそのまま移す
- 理由: 0005 は spec の Key Entities（版・初めて公開した日時・論理削除・代表画像の出どころ・転載先・参照先の情報）をすでに列に持つ。主キーは URL に出さない（ADR-0048、001 の research.md の R17）。`note.slug` は初めて公開するまで書き換わる（spec の FR-003）ため、管理画面の URL に使えない
- 退けた案: `note.slug` を管理画面の URL に使う（書き換えのたびに開いている画面の URL が別の note を指す）。`ALTER TABLE ADD COLUMN` で `uid` を足す（DEFAULT に式を取れず、NOT NULL にできない。0011 と形が分かれる）

## R2 001・002 から使うもの

- 決めたこと: オーナーの判定（`src/shared/server/author.ts`）、env（`src/shared/server/env.ts`）、Server Action の結果の型（`src/shared/domain/action-result.ts`）、入力の部品（`src/shared/components/field.tsx`・`text-link.tsx`・`delete-form.tsx`）、`FormData` の読み方（`src/shared/server/form-data.ts`）、uid の読み方（`src/shared/domain/uid.ts`）、`src/proxy.ts` の 404・403 の決め方をそのまま使う。D1 へは ORM を使わず `prepare()`・`bind()`・`batch()` で読み書きする（ADR-0035）
- 置き場: `src/features/note/` に domain・application・components・server を置く（ADR-0026・ADR-0027。`note` は ADR-0027 が挙げる名前）。R2 の読み書きは `src/shared/server/media-storage.ts` に閉じ込める（constitution VIII）。使い手は note と、001 の research.md の R14 が挙げる実績・職歴（constitution IX の 2 つ目の使い道）

## R3 URL

- 決めたこと:
  - 訪問者: `/notes/{slug}`（note のページ）、`/notes/{slug}/images/{file}`（画像）、`/notes/{slug}/card-image`（題を入れて自動で作る代表画像）
  - 管理画面: `/dash/notes`（一覧。削除した note を別に並べる）、`/dash/notes/new`、`/dash/notes/{uid}`（編集・公開・下書きに戻す・転載先・画像・代表画像）、`/dash/notes/{uid}/preview`（公開したときの見た目）、`/dash/notes/{uid}/revisions`、`/dash/notes/{uid}/revisions/{番号}`（過去の版と、その版に戻す）、`/dash/notes/{uid}/delete`（削除の確認）、`/dash/notes/{uid}/images/{file}`（オーナーが見る画像）
- 既定（実装者、2026-11-09）: 訪問者の URL の形は `/notes/{slug}`。ADR-0016 の「コレクション名と識別子で表す」と、ADR-0016 の Consequences が挙げる `/notes` に従う
- 理由: ADR-0016・ADR-0048。版は note ごとの番号（R4）で指し、主キーを出さない。画像は R2 のキーの末尾（乱数のファイル名）で指し、主キーを出さない

## R4 版の番号と楽観ロック

- 決めたこと: 版の番号は、その note の版を古い順に 1 から数えた値とし、列を足さない（版は書き換えず、完全に消す R13 のほかでは消さないため、番号は変わらない）。編集の画面は、開いたときの最新の版の番号を隠しフィールドで送る。保存は `INSERT INTO note_revision … SELECT … WHERE (その note の版の数) = ?開いたときの番号` の 1 文で行い、当たらなければ保存を止め、送られた内容をフォームに戻して知らせる（FR-020）。保存できたら、保存した版の番号を次に比べる番号にする（FR-021）
- 既定（実装者、2026-11-09）: 公開の操作も、開いたときの最新の版の番号と比べ、違えば公開しない。公開は、その時点の最新の版を訪問者に出す操作で、オーナーが見ていない版を出さないため（設計原則 2「止まる over 危ない方へ進む」）
- 既定（実装者、2026-11-09）: 保存を止めたあとの手順は、止めた画面の内容をそのまま残し（フォームと R11 の端末の書きかけ）、最新の版を別のタブで開くリンクを示す。オーナーは 2 つを見比べて書き直し、開き直してから保存する。自動で合わせない
- 理由: spec の Assumptions「同時編集で比べるのは版だけで、そのための値を足さない」。主キーの版の id は隠しフィールドに出さない（001 の research.md の R17）
- 限界: 2 つの画面が同じ番号から同時に保存すると、1 文の条件が一方だけを通す（D1 は書き込みを 1 つずつ行う）

## R5 公開・下書き・削除の状態の移り方

- 決めたこと: `note.status`（`draft`・`published`）と `note.deleted_at` を別に持つ（migration 0005）。公開は `status = 'published'`・`published_revision_id = 最新の版`・`published_at = COALESCE(published_at, 今)` を 1 文で書く。下書きに戻すは `status = 'draft'` だけを書き、公開した版と初めて公開した日時を残す（FR-013・FR-014）。削除は `deleted_at` を入れ、戻すは `deleted_at` を NULL にする。`status` と版は触らないため、戻すと削除前の状態と版に戻る（FR-016・SC-007）
- 削除した note は編集・公開・下書きに戻す・画像・転載先の操作を受け付けない。管理画面の一覧と編集の画面に「削除済み」と出し、戻す操作だけを置く
- 訪問者に出す条件は `status = 'published' AND deleted_at IS NULL` の 1 か所に置く（Repository の実装）

## R6 本文の書式と描画

- 決めたこと: 本文は Markdown（CommonMark）とし、`react-markdown` 10.1.0 で React の要素に描画する。生の HTML は描画しない（`react-markdown` の既定。HTML を描画する `rehype-raw` を入れない）。リンクと画像の URL は `react-markdown` の既定の `urlTransform` を通し、`javascript:` などを落とす
- 本文の画像は `![説明](media:{file})` と書く。`{file}` は R7 の画像のファイル名。描画のときに、訪問者のページでは `/notes/{slug}/images/{file}`、管理画面のプレビューでは `/dash/notes/{uid}/images/{file}` に置き換える。識別子を本文に書かないため、公開前に識別子を変えても本文の画像が切れない <!-- check-ignore: 本文に書く書き方の例で、リンクではない -->
- 理由: spec の Assumptions「本文の書式は暫定で Markdown」。`react-markdown` は既定で生の HTML を描かず、`dangerouslySetInnerHTML` を使わない（[react-markdown の Security](https://github.com/remarkjs/react-markdown#security)、2026-11-09 に確認）。設計原則 1「守る over 手軽さ」
- 退けた案: Markdown を HTML の文字列にして `dangerouslySetInnerHTML` で入れる（`marked` など。消毒の道具を別に要る）。自前の書式（画像の印・URL の行の決まりを自分で作ると、オーナーが覚える書き方が増える）

## R7 画像

- 決めたこと:
  - 形式は JPEG・PNG・WebP・GIF。SVG は受け付けない（スクリプトを持てるため）。形式はファイルの先頭のバイトで見分け、送られた種類の名前を信じない
  - 上限（constitution II）: 1 枚 5 MB、1 つの note に 30 枚。超えたら保存しない。Server Action の本文の上限を `next.config.js` の `experimental.serverActions.bodySizeLimit` で 6 MB にする（vinext の既定は 1 MB。`vinext/dist/entries/app-rsc-entry.js`）
  - R2 のキーは `notes/{uuid}.{拡張子}`。`{uuid}.{拡張子}` を本文と URL のファイル名にする。`media.note_id` で持ち主を 1 つにする
  - 追加は R2 に書いてから `media` に行を入れる。行を入れられなければ、書いた R2 の物を消す
  - 配る条件（FR-026）: 訪問者には、note が公開で削除していないときに、公開した版の本文が `media:{file}` を含む画像か、代表画像に選んだ画像だけを返す。それ以外は 404。オーナーには、その note の画像をすべて返す。応答は `Cache-Control: no-store` にし、公開をやめた後にどのキャッシュにも残さない（NFR-09）
- 既定（実装者、2026-11-09）: 本文から消した画像のデータは残す。過去の版に戻すと、その版の本文が指す画像が要るため（FR-009）
- 既定（実装者、2026-11-09）: 画像の置き場（R2）と `media` のずれは、`media` を正とする。`media` の行の無い R2 の物は配らない（配る経路が `media` を引く）。`media` の行があり R2 の物が無ければ 404 を返す。ずれを直す定期の処理は持たない
- 理由: spec の FR-023〜FR-026。画像の配信はサイトを通す（FR-026）

## R8 代表画像

- 決めたこと: `note.card_image` が `generated` なら `/notes/{slug}/card-image` を、`media` なら `/notes/{slug}/images/{file}` を、`site` ならサイト共通の画像（`/opengraph-image`）を `og:image` にする。`generated` の画像は `next/og` の `ImageResponse` で 1200×630 に作り、`twitter:card` を `summary_large_image` にする（docs/CRAWLING.md）。題の文字は Noto Sans JP を Google Fonts から題の文字だけの部分集合で取り、取れなければ題を入れずにサイト名だけを描く
- 代表画像に選べるのは、その note の `media` だけ（FR-025。複合の外部キーも止める）。本文と別に登録する画像も、本文の画像と同じ追加の操作で `media` に入れる
- 理由: spec の FR-024・FR-025。訪問者がカードを取りに来たときに外部の書体を取る費用は、題の文字だけの部分集合に限る（設計原則 2）

## R9 URL カード

- 既定（実装者、2026-11-09）: カードにする URL は、本文の段落が URL 1 つだけのもの（行に URL だけを書き、前後を空行で区切る）。文の中のリンクはカードにしない
- 既定（実装者、2026-11-09）: 参照先の情報は、オーナーが版を保存したときに、その版のカードにする URL のうち `link_preview` に行の無いものを取りに行く。取り直しは、編集の画面の「参照先の情報を取り直す」の操作で、最新の版のカードにする URL のすべてを取り直す。本文から消えた URL の `link_preview` の行は消さない（FR-017 と同じく、ほかの note が使いうるため）
- 上限（constitution II）: 1 回の保存・取り直しで取りに行く URL は 10 個まで、1 つあたり 5 秒で打ち切り、応答の本文は 512 KB までしか読まない。`http`・`https` だけを取り、`wrangler.jsonc` の `global_fetch_strictly_public` で私的なアドレスへ出さない。取れなくても保存を止めない（設計原則 4）
- 既定（実装者、2026-11-09）: 参照先の情報が取れなかった URL は、カードにせず、URL の文字のリンクで出す
- 既定（実装者、2026-11-09）: カードの画像は、参照先の画像の URL（`https` に限る）を `<img>` でそのまま指し、`referrerpolicy="no-referrer"` と `loading="lazy"` を付ける。画像を保管しない（FR-030）。出し方の決定は #186 が持つ
- 取り出し: 題は `og:title`、無ければ `<title>`。画像は `og:image`。HTML の読み取りは Workers の `HTMLRewriter` で行い、`src/features/note/server/link-preview-fetcher.ts` に閉じ込める（constitution VII・VIII）
- 理由: spec の FR-027〜FR-030、SC-005。表示のたびに参照先へ取りに行かない

## R10 転載先

- 決めたこと: 編集の画面で、転載先の URL を足す・消す。同じ URL は、どの note にも 2 つ目を入れない（`syndication.url` の UNIQUE、FR-032）
- 既定（実装者、2026-11-09）: 転載先の URL は訪問者に見せない。一覧から重なりを除くための記録として持つ（ADR-0006、spec の User Story 7）。見せる見た目が決まってから足す

## R11 書きかけの内容の保持

- 決めたこと: 編集の画面は、入力中の題・説明文・本文を、ブラウザの `localStorage` に note ごとのキーで持つ。持つ値に、書き始めたときの版の番号を添える。画面を開いたときに保存していない書きかけがあれば、入力に戻し、隠しフィールドの「開いたときの版の番号」も書きかけの番号に戻す。こうすると、書きかけの後に別の画面で保存されていれば、保存が R4 で止まる。保存に成功したら消す。D1 には書かない（FR-018・FR-019）
- 置き場: `src/features/note/components/` に置く。001 の tasks.md の T072 が作る `src/shared/components/draft-retention.tsx` と同じ役目だが、版の番号を添えて戻す点が note に固有である。2 つがそろった後に、1 つにまとめるかを決める
- 理由: REQUIREMENTS.md の FR-14、spec の User Story 4

## R12 キャッシュと 404・403

- 決めたこと: note のページと管理画面は `'use cache'` を使わない。無い識別子・下書き・削除した note の `/notes/{slug}` は、`src/proxy.ts` が描画の前に `/notes/{slug}/missing` へ rewrite し、404 にする。`/dash/notes/{uid}` の無い uid と、`/dash/notes/{uid}/revisions/{番号}` の無い番号も、同じく proxy が 404 にする
- 既定（実装者、2026-11-09）: 削除した note の URL は、無い識別子と同じ 404 を返す。note があったことを訪問者に示さない（設計原則 1）
- 既定（実装者、2026-11-09）: 公開の操作のあと、次の要求から訪問者に見える。キャッシュは、計測値が閾値を割るまで足さない（constitution VI、001 の research.md の R12）
- 理由: constitution の Cacheability（ADR-0040）

## R13 完全に消す

- 決めたこと: 完全に消す画面は作らない（spec の Assumptions）。Repository に、1 つの `batch()` で `syndication`・`media`・`note_revision`・`note` を消す操作を置き、workerd の検査で一部だけ残らないことを確かめる（FR-017）。`link_preview` は消さない
- 理由: spec の FR-017。画面ができたときに、消し方を作り直さないため

## R14 更新日

- 既定（実装者、2026-11-09）: 初めて公開した日とは別の更新日は、持たず、訪問者に出さない。`note.updated_at` は行を書き換えた日時で、版の保存では変わらないため、更新日に使わない。#150 が決める

## R15 識別子の候補

- 既定（実装者、2026-11-09）: 題から識別子の候補を示さない。作る画面で、オーナーが識別子を入れる。ADR-0016 は「題から候補を提示し、作り手が確定させる」とするが、日本語の題から英小文字の候補を作る方法が決まっていない。候補を示す形は、決まってから足す
