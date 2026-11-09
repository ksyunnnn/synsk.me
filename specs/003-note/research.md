# Research: note

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。決められないものは「未決」として理由と止める範囲を書く。未決の一覧は plan.md の「未決」が持つ。

## Contents

- R1 スキーマの前提
- R2 001・002 の部品を使う
- R3 機能の切り方
- R4 版の保存と同時編集
- R5 公開・下書きに戻す・削除・元に戻す
- R6 完全に消す
- R7 訪問者への取り出し
- R8 識別子
- R9 キャッシュと 404・403
- R10 書きかけの保持
- R11 本文の書式
- R12 画像と代表画像
- R13 URL カード
- R14 転載先
- R15 公開前の見た目の確認
- R16 スマートフォンからの操作
- R17 版が増えたときの扱い
- R18 ほかの spec との重なり（issue #219 の調査）

---

## R1 スキーマの前提

- 決めたこと: `migrations/0001`〜`0011` に、共有担当が足す migration（note と note_revision の uid）を当てたスキーマを前提にする。D1 を使う検査（workerd・結合・E2E）は、このスキーマを当てた D1 で回す。003 は migration を書かない
- 使う表: `note`・`note_revision`・`media`（持ち主が note の行）・`syndication`・`link_preview`。いずれも `migrations/0005_rebuild_note_and_create_media.sql` が作る
- 共有担当の migration で足すもの: `note.uid` と `note_revision.uid`。形は 0011 と同じ（16 バイトの乱数の 16 進表記の 32 文字を DB の DEFAULT が入れ、NOT NULL・UNIQUE・形の CHECK、書き換えを拒むトリガ）。ADR-0051 は、管理画面で 1 行ずつ開くすべての表に uid を持たせ、主キーを URL にもフォームにも出さないとする。note は `/dash/notes/{uid}` で、過去の版は `/dash/notes/{uid}/revisions/{revisionUid}` で開く。同時編集の比べる版（R4）も隠しフィールドで版の uid を送る
- 理由: 0005 のスキーマが、識別子の形と重複（FR-002）、公開した note の識別子の固定（FR-003）、版を書き換えないこと（FR-006）、題が空の版を公開しないこと（FR-011）、初めて公開した日時の固定（FR-013）、代表画像がその note の画像だけを指すこと（FR-025）、転載先の重複（FR-032）、参照先の情報を URL ごとに 1 つ持つこと（FR-029）を CHECK・UNIQUE・トリガで持つ
- 退けた案: 主キーを管理画面の URL と隠しフィールドに出す。ADR-0051 に反する

## R2 001・002 の部品を使う

- 決めたこと: オーナーの判定・env・Server Action の結果の型・フォームの値の読み方・入力の部品・uid の引き方・proxy の形を、001・002 のものをそのまま使う。一覧は plan.md の「再利用する既存の部品」が持つ
- 共有担当が作るものを使う: 書きかけの保持の部品（001 の T072、`src/shared/components/draft-retention.tsx`）、slug の形の検査（`src/shared/domain/slug.ts` の `isSlug`、PR #222）、画像の保存と配信の共通部分（`src/shared/server/media-storage.ts`）。003 はこれらを作らない
- 理由: 001・002 と同じ形にすると、同じ検査の道具（`tests/support/access.ts`・`tests/integration/support/`）と同じ読み方で確かめられる。issue #219 の調査の報告（spec どうしの重複）が、書きかけの保持と slug の形を 2 つ以上の spec が使うと挙げた
- 退けた案: note の中に同じ部品をもう 1 つ作る。issue #219 の調査が挙げた重複を増やす

## R3 機能の切り方

- 決めたこと: `src/features/note/` に `domain/`・`application/`・`components/`・`server/` を置く。版・画像・転載先・参照先の情報も note の中に置く
- 理由: ADR-0027 が `note/` を挙げる。版・転載先は note に属し、参照先の情報は note の本文からだけ指される（spec の Key Entities）。機能どうしは import しない（ADR-0026）
- 一覧（005）は note を `activity_feed` のビューで読み、`src/features/note/` を import しない（005 の spec の FR-015、ADR-0044）。003 は、ビューが読む列（`note.status`・`note.deleted_at`・`note.published_revision_id`・`note.created_at`、`note_revision.title`・`note_revision.description`、`syndication.url`）の意味を変えない
- 退けた案: 参照先の情報を `src/shared/` に置く。使い手が note だけで、constitution IX の 2 つ目の使い道が無い

## R4 版の保存と同時編集

- 決めたこと（FR-005〜FR-009、FR-020・FR-021）:
  - 作成は、`note` の行と 1 つ目の版を 1 回の `batch()` で入れる。どの note も 1 つ以上の版を持つ
  - 編集の画面は、開いたときの最も新しい版の uid を隠しフィールドで持つ。保存は `INSERT INTO note_revision (note_id, title, description, body) SELECT ?, ?, ?, ? WHERE (SELECT uid FROM note_revision WHERE note_id = ? ORDER BY id DESC LIMIT 1) = ?開いたときの版の uid` に、`AND EXISTS (SELECT 1 FROM note WHERE id = ? AND deleted_at IS NULL)` を足して行う。`meta.changes` が 0 なら、Repository が note を読み直し、無いか削除していれば `not-found`、そうでなければ `conflict` を返す。`conflict` は保存を止め、送られた内容をフォームに戻して知らせる。`not-found` は 001 の `editProject` と同じく一覧へ 303 で移す（contracts/dash.md）
  - 同じ保存で識別子を変えるとき（FR-003）は、同じ `batch()` の版の INSERT より前に、同じ条件を付けた `UPDATE note SET slug = ?` を置く。条件に合わなければどちらも書かない。識別子の重複は UNIQUE が拒み、`batch()` 全体が戻る
  - 保存に成功したら編集の画面へ 303 で移り、画面は最も新しい版（保存した版）を読み直して隠しフィールドに置く（FR-021）
  - 過去の版に戻す（FR-009）は、戻す版の題・説明文・本文を、上と同じ条件の INSERT で新しい版として足す。公開した版は変えない
- 決定（2026-11-09、オーナー）: 比べる値は最も新しい版で、001 の FR-042・002 の FR-038 が使う `updated_at` に揃えない。根拠は spec の FR-020・FR-021 と Assumptions の「同時編集で比べるのは版だけで、そのための値を足さない」。`note.updated_at` は公開・下書きに戻す・削除・識別子・代表画像・転載先でも変わるため、`updated_at` で比べると FR-020 が止めない操作でも保存が止まる
- 001・002 と揃えるもの: 止めたときの結果（`src/shared/domain/action-result.ts` の `conflict`、送られた値を返す）、画面が入力を消さずに知らせること、隠しフィールドで開いたときの値を送る形
- 理由: `batch()` は 1 つのトランザクションで、1 文が失敗すると全体を戻す（001 の research.md の R2）。版の uid は書き換わらず、版は消えない（R6 の完全に消すときを除く）ため、比べた値が同じなら同じ版を指す。001 の R7 の限界（同じミリ秒の 2 つの保存を見分けられない）は起きない
- 退けた案: `note.updated_at` で比べる（上の決定）。版の連番の列を足す（Assumptions が値を足さないとする）

## R5 公開・下書きに戻す・削除・元に戻す

- 決めたこと:
  - 公開（FR-011・FR-013）: `UPDATE note SET status = 'published', published_revision_id = (最も新しい版の id), published_at = COALESCE(published_at, ?今の日時) WHERE id = ? AND deleted_at IS NULL`。題が空の版はアプリケーションが先に止めて項目で知らせ、トリガ `note_published_revision_valid` を最後の守りに残す
  - 下書きに戻す（FR-014）: `status = 'draft'` だけを書く。`published_revision_id` と `published_at` は残す
  - 削除（FR-016）: `deleted_at` に今の日時を書く。`status` は変えない
  - 元に戻す（FR-016・SC-007）: `deleted_at` を NULL にする。`status`・版・識別子は削除の前のまま残っているため、削除前の状態に戻る
  - 公開・下書きに戻す・削除・元に戻すは、開いたときの版と比べない。公開の操作でも比べるかは未決（U6）で、決まるまでは FR-011 のとおり、その時点の最も新しい版を公開する
- 理由: 0005 の CHECK とトリガが、公開した note の識別子・公開した版・初めて公開した日時を守る。削除は行を消さないため、元に戻すときに識別子が重ならない（spec の Edge Cases）
- 退けた案: 削除で `status` を別の値にする。元に戻すときに削除前の状態が分からなくなる

## R6 完全に消す

- 決めたこと: Repository に完全に消す処理を置き、1 回の `batch()` で `media`（持ち主が note）・`syndication`・`note_revision`・`note` の順に消す（FR-017、`docs/REQUIREMENTS.md` の FR-11）。`link_preview` は消さない。管理画面からこの処理を呼ぶ画面は作らない（spec の Assumptions）
- 指す先を空にしてから消す手順は取らない。公開したことのある note で `published_revision_id` を空にすると、CHECK `(published_revision_id IS NULL) = (published_at IS NULL)` に当たり、`published_at` はトリガが変えさせない。note から版と画像を指す外部キーの検査はトランザクションの終わりに送られる（0005 の冒頭の注釈）ため、この順で消せる。公開した note・代表画像を持つ note で消せることを workerd の検査で確かめる
- R2 の画像の実体は、D1 の削除が成功した後に `src/shared/server/media-storage.ts` で消す。R2 の削除に失敗しても、持ち主の行が無いため画像は訪問者に出ない（001 の research.md の R8 と同じ）
- 理由: 一部だけが残る状態にしない（FR-017）。`batch()` は 1 文が失敗すると全体を戻す
- 退けた案: CASCADE（表を作り直す migration で子の行が黙って消える。0003 の冒頭）

## R7 訪問者への取り出し

- 決めたこと: 訪問者向けの取り出しは、Repository の実装の中で `note.status = 'published' AND note.deleted_at IS NULL` を条件にし、`note.published_revision_id` の版だけを読む。出す項目は [contracts/visitor-note.md](./contracts/visitor-note.md) の DTO に列挙する（FR-012・FR-015・FR-016・SC-001）。最も新しい版は読まない
- ページの `<title>` と OGP の説明にも同じ DTO の値を使う。説明文が空なら本文の冒頭を説明に使う（spec の Assumptions、`docs/CRAWLING.md`）。冒頭の抜き出し方は R11
- 訪問者の URL は `/notes/{slug}`（FR-004）。ADR-0048 が「URL は resourceful routing に従い、コレクション名と識別子で表す」とし、Consequences に `/notes` を切れば一覧に辿り着けるとする。spec はこの形を未決とするため、オーナーに確かめる（U2）
- 削除した note の URL は、無い識別子と同じ 404 にする。中身を応答に含めない（FR-016）。別の応答にするかは未決（U10）
- 理由: ADR-0029（取り出すときに確かめる）、ADR-0028（DTO）、constitution の Allowlist Visibility
- 退けた案: 全列を読んで画面で外す（ADR-0029 が退けた）

## R8 識別子

- 決めたこと: 識別子の形（1〜100 文字の英小文字・数字・ハイフン、FR-002）は、共有担当の `src/shared/domain/slug.ts` の `isSlug` を使う。重複（削除した note を含む）は `note.slug` の UNIQUE が拒み、アプリケーションは項目の誤りとして知らせる。一度でも公開した note（`published_at` を持つ）の識別子の書き換えは、アプリケーションが先に拒み、トリガ `note_slug_fixed_after_publication` を最後の守りに残す（FR-003）
- 識別子はオーナーが入れる。題から候補を示すかは未決（U3）で、決まるまで候補を示さない
- 001 の R6 と 002 の uid（`crypto.randomUUID()` の 36 文字、`slug.ts` の `newSlug`）は使わない。note の識別子の既定を uid にする要件は無い
- 理由: issue #219 の調査が、001・002・003・004 が同じ slug の形を定めるとし、共有担当がまとめる（R2）

## R9 キャッシュと 404・403

- 決めたこと: `/notes/[slug]` と `/dash/notes/*` は `'use cache'` を使わない。データを読んでから決まる 404（識別子の公開の note が無い、管理画面の uid の note・版が無い）と 403（オーナーでない `/dash`）は `src/proxy.ts` が描画の前に決め、`notFound()` か `forbidden()` を呼ぶだけのページへ rewrite する。`export const revalidate` と `export const dynamic` は書かない
- `src/proxy.ts` の matcher に `/notes/:slug` と `/notes/:slug/media/:key`（R12）を足し、`DASH_ROW_EXISTS` に `notes` を足す。過去の版の画面（`/dash/notes/{uid}/revisions/{revisionUid}`）は、002 の写した行と同じく、note と版の有無を 1 回で確かめる
- 画像の経路（`/notes/{slug}/media/{key}`）は matcher に入れて dynamic に固定する（ADR-0040 の Consequences）が、proxy は D1 を読まない。見せてよいかは `route.ts` が 1 回だけ確かめ、見せなければ自分で 404 と `Cache-Control: no-store` を返す。ADR-0040 が proxy で 404 を決める理由は、描画をストリーミングすると状態コードが保てないことで、`route.ts` は描画せずに `Response` を返すため当たらない。proxy でも確かめると、画像 1 枚ごとに公開した版の本文（100,000 文字まで）を 2 回読んで構文木にする。proxy は判定に失敗すると素通しにする（`respond` の `catch`）ため、`route.ts` の確かめは省けない
- 理由: constitution の Cacheability（ADR-0040）。キャッシュを使わないため、公開・下書きに戻す・削除の直後の要求から新しい状態で出る。公開の操作のあと見えるまでの時機とキャッシュの扱いは未決（U12）で、計測値が閾値を割るまでキャッシュを足さない（constitution VI）
- `src/proxy.ts` は 001・002 の作業者も直すため、003 の変更は既にある分岐を変えずに足す
- 退けた案: `/notes/[slug]` を `'use cache'` にし、公開のたびに無効化する（計測値が無い）

## R10 書きかけの保持

- 決めたこと: 編集の画面は、共有担当の `src/shared/components/draft-retention.tsx` の `DraftRetainingForm` を使い、書きかけの内容をその端末の `localStorage` に持つ。`storageKey` は `note:<note の uid>`、`version` は開いたときの最も新しい版の uid、`result` は Server Action の結果を渡す。部品は送信で消し、`saved` 以外の結果（`conflict` を含む）で送った値を持ち直す（FR-018・FR-019、User Story 4、spec の Edge Cases）
- `version` に版の uid を渡す理由: 渡さないと、別の画面で先に保存された後に開き直したとき、古い版から書いた書きかけが最も新しい版の中身の上に戻り、触っていない項目まで古い値で保存する（FR-020 が防ぐ上書き）。渡すと、前の版の書きかけは消さずに残し、自動では戻さない。残した書きかけをオーナーにどう見せるかは U7 に含める
- D1 には書かない。別の端末は D1 の最も新しい版を読むため、書きかけの内容は出ない（FR-019）
- 理由: `docs/REQUIREMENTS.md` の FR-14、001 の research.md の R16
- 退けた案: 書きかけの内容を D1 に自動で保存する（FR-018 が保管するデータに書かないとする）

## R11 本文の書式

- 決定（2026-11-09、オーナー。plan.md の U4）: 本文は Markdown で書き、生の HTML を通さない。画像は `media` を指す識別子で指し、キャプションを添える。URL カードは、行に URL だけを書いた行から作る
- 決定（2026-11-09、PM）: 画像を指す識別子は `media.storage_key`（共有担当の `src/shared/server/media-storage.ts` が作る UUID の `storageKey`、PR #225）で、主キーではない。ADR-0051 が主キーを管理画面のフォームに出さないとするため。U4 の決定の記録の「media の id」は、この識別子を指す
- 決定（2026-11-09、PM）: Markdown を読む部品と描く部品は共有担当が `src/shared/` に作り、003 は使う。使い手は 001 の職歴・実績の本文（001 の T077）と 003 の note の本文の 2 つ（constitution IX）。package（`react-markdown`・`mdast-util-from-markdown`）も共有担当が足す。ファイル名は共有担当の PR で確かめる
- 003 が共有担当の部品に求めること（下の決めたことを満たすため）:
  - 本文を構文木にして、画像の印の `storageKey` の並び、行に URL だけを書いた行の URL の並び、最初の段落の文字列を返す関数。正規表現で読むと、コードの中に書いた印まで拾い、表示しない画像を訪問者に出す
  - 描く部品が、画像の `src` を作る関数（note は `/notes/{slug}/media/{storageKey}`）と、行に URL だけを書いた行を描く部品（note は URL カード、U9 が解けてから）を受け取れること
  - `urlTransform` が `img` の `media:` だけをそのまま通し、ほかを `defaultUrlTransform` に任せること。既定のままだと `media:<storageKey>` が空の文字列になる（react-markdown 10.1.0 の `lib/index.js` の `safeProtocol` と `defaultUrlTransform`、2026-11-09 に確かめた）
- 決めたこと:
  - 本文は `note_revision.body` に文字列で持つ（100,000 文字まで、FR-005）。入力は `<textarea>`
  - 生の HTML を通さない: `dangerouslySetInnerHTML` を使わず、`rehype-raw` を足さない
  - 画像の印: `![代替テキスト](media:<storageKey> "キャプション")`。訪問者には `<figure>` の中に `<img alt>` と `<figcaption>` で出す。画像の URL は R12 の配る経路から作る <!-- check-ignore: 本文の画像の記法の例 -->
  - カードにする行: 段落の中身が `http` か `https` の URL の文字列 1 つだけの行。行の中に文と並べて書いた URL はカードにしない。GFM を使わないため、`<https://…>` の autolink かリンクの記法で書いた URL だけがリンクになり、そのまま書いた URL は文字列で出る（CommonMark の Autolinks）。カードにする行も、U9 が解けるまでは文字列で出る
  - 説明文が空のときの説明: 本文の最初の段落の文字列（改行は空白にする）
  - 書式は CommonMark だけを使う
- 理由: 原則 1（守る over 手軽さ）。HTML の文字列を作って差し込む形（`marked` など）は、出力をもう一度無害にする処理が要る
- 退けた案: `marked`・`markdown-it`（HTML の文字列を返し、`dangerouslySetInnerHTML` と無害化の package が要る）。正規表現で画像の印と URL を拾う（上の理由）。note の中に Markdown の部品を作る（001 の T077 と同じものを 2 つ作る）
- plan で決めたこと（オーナーの決定の外）: 画像の印の書き方（URL の欄を `media:<storageKey>`、キャプションを題の欄にする）、カードにする行の見分け方、説明の抜き出し方。001 と同じ書き方にするため、共有担当の部品の決まりに合わせる

## R12 画像と代表画像

- 決定（2026-11-09。オーナーから任されて Claude が決めた。plan.md の U5、[issue #219 の報告](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6732716576)）: R2 に原本を置き、Worker が持ち主ごとに見せてよいかを確かめてから、変換せずに返す。公開していない画像の応答には `Cache-Control: no-store` を付ける。形式は JPEG・PNG・WebP・GIF で、SVG は受けない。1 枚 10 MB まで
- 決めたこと:
  - 画像の記録は `media` に持ち、持ち主の列は `note_id`。R2 への読み書き・形式と大きさの検査は共有担当の `src/shared/server/media-storage.ts` が持つ。003 は、note の画像を足す操作と、note の画像を訪問者に出してよいかの確かめを持つ（FR-023・FR-026）
  - 配る経路は `/notes/{slug}/media/{key}`。`{key}` は `media.storage_key`（UUID、PR #225）で、本文の画像の印と同じ値（R11）。主キーは URL に出さない（ADR-0048）。見せてよいかは `route.ts` が確かめ、結果を共有担当の `respondWithMedia` に渡して応答を作る（R9）
  - 量の上限（constitution II）: 1 枚 10 MB、1 回の操作で 1 枚
  - 代表画像の出どころは `note.card_image`（`generated`・`media`・`site`）。既定は `generated`（FR-024）。`media` を選べるのは、その note の画像だけ（複合の外部キー、FR-025）
  - 訪問者に出してよい画像は、note が公開で削除していないときの、公開した版の本文が指す画像と、代表画像だけ（FR-026）。この確かめは画像を配る経路の中で、Repository が取り出すときに行う。公開した版の本文が指す画像の `storageKey` は、共有担当の Markdown の部品で読む（R11）。その note の `media` の行に無い `storageKey` は出さない
- 未決:
  - U14: 本文から消した画像のデータを残すか、画像の置き場と保管するデータのずれの扱い（spec の「決定が無く」）。決まるまで、本文から消した画像も `media` と R2 に残す。訪問者には公開した版の本文が指す画像だけを出すため、残しても出ない
  - U8: 題を入れて自動で作る画像の作り方と使い回し方。`docs/CRAWLING.md` の「取得の負荷」は、カード画像を一度作ったら使い回し、取得のたびには作らないとする。作り方と使い回し方を決めるまで、自動で作る画像を出さない
- U8 で止めないもの: `card_image` の `generated` と `site` の選択の保存と、`site` のときにサイト共通の画像を OGP に出すこと
- 理由: 004 の spec の FR-030 は画像の仕組みを 003 が持つとするが、issue #219 の進め方の宣言（2026-11-09）が画像の保存と配信を共有担当に割り当てた。003 の plan は共有担当の部品を使う

## R13 URL カード

- 決めたこと: カードにするのは、行に URL だけを書いた行（R11）。参照先の情報は `link_preview` に URL ごとに 1 つ持ち、版には URL だけを残す（FR-029）。画像は URL だけを持つ（FR-030）。訪問者の表示は `link_preview` を読むだけで、参照先へ取りに行かない（FR-028・SC-005）。参照先の情報が取れない URL を書いた note も保存でき、公開できる（spec の Edge Cases）。保存・公開は参照先の取得の成否を待たない
- 参照先への取得は、取得した HTML を境目で synsk.me の形（題・画像の URL）に詰め替え、外の形を持ち込まない（docs/SOFTWARE_DESIGN.md の Anti-Corruption Layer）。外への取得は constitution II の対象で、1 回の保存で取りに行く URL の数・1 回の取得の時間と大きさの上限を、作る前に plan に書く
- 未決:
  - U9: 参照先の情報を取る時機と取り直す時機、本文から消えた URL の情報の扱い、取れなかった URL の見せ方、カードの画像の出し方（spec の「決定が無く」）。止める範囲は参照先への取得とカードの表示
- U9 で止めないもの: カードにする行の見分け（R11）、`link_preview` の読み書き（URL ごとに 1 つ、取り直すと同じ行を書き換える）と、その workerd の検査（FR-028〜FR-030、User Story 6 の 3）
- 退けた案: 版の本文に参照先の題を書き込む（FR-029 が版の外に持つとする）

## R14 転載先

- 決めたこと: 転載先は `syndication` に持つ。オーナーは編集の画面で URL を足し、外す（FR-031）。同じ URL は、同じ note にも別の note にも記録できない（`syndication.url` の UNIQUE、FR-032）。URL は `src/shared/domain/web-url.ts` の `isWebUrl` で http か https に限る
- 外すフォームは、主キーでなく URL を送って行を指す。`syndication.url` は UNIQUE のため 1 行に決まる。uid を足さない（ADR-0051 の主キーを出さない決まりを満たす）
- 訪問者には出さない。出すかは未決（U11）で、許可リスト方式（constitution）により、決まるまで DTO に入れない
- 理由: ADR-0006 の重複エントリの除外は、一覧（005）が `syndication.url` で外部の activity を除く。003 は記録までを持つ

## R15 公開前の見た目の確認

- 決めたこと: `/dash/notes/{uid}/preview` で、最も新しい版を訪問者向けと同じ部品で描く。状態と削除に関わらず出す（`docs/REQUIREMENTS.md` の FR-13）。DTO は訪問者向けと同じ形を、最も新しい版から詰める
- 理由: 002 の `/dash/resumes/{uid}/preview` と同じ形

## R16 スマートフォンからの操作

- 決めたこと: 管理画面はネイティブの要素と `<form>` で作り、Playwright のスマートフォンの端末の設定（画面の幅と触れる操作）で、作成・保存・公開を E2E で確かめる（FR-022・SC-006、constitution V）
- 理由: constitution V は、キーボードだけ・読み上げ・スマートフォンのそれぞれで同じ操作ができることを求める

## R17 版が増えたときの扱い

- 決めたこと: 版を消す・まとめる仕組みを作らない。データの大きさを測る SQL を quickstart.md に置き、閾値を割ってから決める（spec の Assumptions、constitution VI）
- 測る値: note ごとの版の数と、`note_revision` の `length(body)` の合計

## R18 ほかの spec との重なり（issue #219 の調査）

issue #219 の報告「spec どうしの重複・干渉・矛盾・依存を調べた」のうち、003 に関わる指摘と、この plan での扱い。

| 指摘 | 扱い |
|---|---|
| 画像の保存と配信の持ち主が決まっていない | 共通部分は共有担当が作り、note 固有の確かめは 003 が持つ（R12） |
| 書きかけの保持（001 の T072 と 003 の FR-018） | 共有担当の部品を使う（R10） |
| 同時編集の止め方（001・002 は updated_at、003 は版） | 版で比べる。2026-11-09 にオーナーが決めた（R4） |
| slug の形が 4 つの spec で同じ | 共有担当の検査を使う（R8） |
| migration の番号（003 と 004 の並行） | 003 は migration を書かない。共有担当が書く（R1） |
| media の表に 001・003・004 が書き込む | 003 は持ち主が note の行だけを書く。保存の部品は共有担当（R12） |
| ER 図のファイルを 003・004・005 が直す | 003 は直さない。要る変更は PM に伝えた（下の 2 行） |
| ADR-0051 の uid が note に無い | 共有担当の migration で `note.uid`・`note_revision.uid` を足す（R1） |
| ER 図の note_revision の説明「保存と公開のたびに 1 行」 | FR-006・FR-011 と 0005 は保存のたびに 1 行。ER 図の修正を共有担当に渡した |
| 0005 の注釈が旧名 `specs/005-note-write-and-read` を指す | 注釈の修正の扱いを共有担当に渡した。003 の要件番号との対応は data-model.md が持つ |
| 「uid」の意味の食い違い（36 文字と 32 文字） | 003 の uid は管理画面の URL の 32 文字だけ。識別子（slug）に uid を使わない（R8） |
| 本文の書式（U4）を 001 の職歴・実績の本文（001 の T077）と 003 が使う | Markdown を読む部品と描く部品は共有担当が `src/shared/` に作る（2026-11-09、PM。R11） |
| 004 の research.md が、題の取り方の案 (b) で 003 の URL カードの取得を使うとする | 004 が (b) を選べば、参照先への取得（U9、T043）の使い手が 2 つになり、共有担当の部品にする。004 の推奨は (a) で、003 は U9 が解けるまで取得を作らない |
| 依存 003 → 001、004 → 003（画像）、005 → 003 | 001・002 の部品を使う（R2）。005 が読む列の意味を変えない（R3）。004 とは画像の部品を共有担当経由で共有する |
