# Research: 一覧

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。spec の「決定が無く、この spec では決めない」項目と「実装のときに詰めるもの」に、実装者が置いた既定は「既定（実装者、2026-11-09）」と書く。既定の一覧は plan.md の「未決」が持つ。

## Contents

- R1 スキーマの前提と足す migration
- R2 機能の置き場
- R3 ビューが出す列と列の名前
- R4 並びの日付・日の境目・同じ日の順
- R5 公開と秘匿化の決まりをビューに書く
- R6 転載先と一致する外部の activity を除く
- R7 ページ送り
- R8 画面の名前と URL
- R9 種類ごとの見せ方とリンク
- R10 代表画像
- R11 職歴のスキル
- R12 キャッシュ・404・状態
- R13 読み取り行数

---

## R1 スキーマの前提と足す migration

- 決めたこと: 一覧のための表を作らず、`migrations/0025_create_activity_feed.sql` でビュー `activity_feed` を作る。ビューは `activity`・`activity_source`・`note`・`note_revision`・`syndication`・`project`・`project_skill`・`skill`・`career`・`organization` を読む。訪問者の一覧はこのビューだけを読む
- 理由: ADR-0044 の「一覧は、activity・note・project・career を UNION ALL でつなぐビュー（activity_feed）で読む。公開側はこのビューだけを読む」。spec の Key Entities は「一覧のために値を写して持たない」
- 番号: #208〜#211 を並行して進めるため、この機能は 0025 以降を使う。#209 の `0015`、#210 の `0020`・`0021` の後に当たるため、作り直した `note` と `activity` の上にビューを作る
- 退けた案: 一覧の行を写して持つ表（ADR-0044 が退けた。読み取りが遅いと測れたときに移る。R13）

## R2 機能の置き場

- 決めたこと: 一覧を `src/features/activity/` に置く。`domain/feed.ts`（DTO と行からの詰め替え）、`domain/feed-repository.ts`（インタフェース）、`server/d1-feed-repository.ts`、`application/list-feed.ts`、`components/feed.tsx`、`server/queries.ts` の `listFeed`
- 理由: ADR-0027 の「timeline は `activity/` の中の部品にする」。ビューが他の機能の表を読むのは SQL の中だけで、TypeScript の機能どうしは import しない（ADR-0026）
- 退けた案: `features/feed/` を新しく作る（ADR-0027 が挙げる名前に無い）

## R3 ビューが出す列と列の名前

- 決めたこと: ビューは訪問者に出してよい値だけを列に持つ（data-model.md）。秘匿化するかで中身が変わる列は `visible_` で始める（`visible_title`・`visible_organization_name`）。種類は `item_type`、種類ごとの番号は `item_id`
- 理由: `docs/SOFTWARE_DESIGN.md` の「列の名前を意味ごとに1つにする」。`organization.name` は実際の値、`organization.name_masked` は秘匿化した値を指す。ビューの組織名はそのどちらかなので、同じ名前を当てると実際の値の列と読み違える。`kind` は `activity_source.kind`（分類）と `project.kind`（実績の種類）が使っているため、一覧の種類には使わない
- 退けた案: `organization_name`（`organization.name` と同じ意味に読める）

## R4 並びの日付・日の境目・同じ日の順

- 決めたこと: ビューの `sort_key` に、種類ごとの並びの日付（spec の FR-007）を文字列で入れる。日時（note の `created_at`、外部の activity の `published_at`）は日本時間に直し、`YYYY-MM-DDTHH:MM:SS.SSS`（末尾の `Z` を持たない）にする。暦の日付（life event の `happened_on`、実績と職歴の `started_on`）は `YYYY-MM-DD` のまま。並びは `sort_key` の降順、`type_rank` の昇順、`item_id` の降順
- 日の境目: 既定（実装者、2026-11-09）: 日本時間で決める。理由: 004 はオーナーが入れた日付を日本時間の 0 時として持つ（004 の research.md の R9）。日の境目を UTC にすると、日本時間の 2024-05-10 08:00 に公開した記事が 2024-05-09 の日の中に並び、2024-05-10 の life event より古くなる
- 暦の日付と日時が同じ日のとき: `YYYY-MM-DD` は同じ日の `YYYY-MM-DDT…` より文字列で小さいので、降順で後に並ぶ。spec の FR-011（起きた日は、その日の公開日時より古いものとして並べる）を満たす。実績・職歴の始まりの日も同じ扱い
- 同じ並びの日付のときの種類の順: 既定（実装者、2026-11-09）: note・外部の activity・life event・実績・職歴の順（`type_rank` 1〜5）。理由: spec の User Story 1 の 1 が挙げる並びの順。synsk.me の中で書いたものを先にする
- 理由: ADR-0044 の「並べるキーは (日付, 種類, id)」。`activity.sort_at` も、暦の日付と日時を文字列のまま比べている
- 退けた案: 日時を UTC のまま比べる（上の 2024-05-10 08:00 の例で FR-011 を割る）

## R5 公開と秘匿化の決まりをビューに書く

- 決めたこと: ビューの各腕が次を WHERE と CASE に持つ
  - note: `status = 'published' AND deleted_at IS NULL`。題と説明文は `published_revision_id` の版から読む（FR-005・FR-006）
  - 外部の activity: `source <> 'life_event'` の行のすべて（FR-002）。取得元で消えた行は 004 が消す（004 の research.md の R7）。転載先と一致する行は R6 で除く
  - life event: `source = 'life_event'` の行のすべて（FR-003）
  - 実績と職歴: `status = 'published'`、かつ、秘匿化しないか組織が秘匿化した組織名を持つ（FR-004）。秘匿化した行は `title_masked`・`name_masked` を `visible_` の列に入れ、`description`・`url`・`card_media_id` を列に持たない（FR-012・FR-013）
- 秘匿化した組織名の無い組織を指す秘匿化した行を出さない理由: 001 の plan.md の U2（2026-11-04 のオーナーの決定）と、001 の research.md の R5。`src/features/project/server/d1-project-repository.ts` の訪問者の取り出しも同じ条件を持つ
- 学歴の表はビューが読まない（FR-001）
- 理由: ADR-0044 の「公開中の note だけを出す決まりと、is_masked の project と career を秘匿化した値で出す決まりは、ビューの中に書く」、ADR-0029（取り出すときに確かめる）。Repository の実装は、ビューが出した列をさらに列挙して DTO に詰める（ADR-0028、constitution の Allowlist Visibility）
- 退けた案: ビューが実際の値と秘匿化した値の両方を出し、Repository が選ぶ（秘匿化した値の選び忘れが、実際の値を出す経路になる）

## R6 転載先と一致する外部の activity を除く

- 決めたこと: 外部の activity の腕で、`syndication.url = activity.url` で、転載元の note が公開で削除していない行があれば除く（FR-016・FR-017）
- 一致とみなす条件: 既定（実装者、2026-11-09）: 文字列が完全に一致するとき。末尾のスラッシュ・問い合わせの部分・大文字と小文字の違いは別の URL とみなす。理由: 設計原則 3。正規化の規則を足すと、別の記事を誤って除く経路ができる。除き損ねても一覧に同じ記事が 2 件並ぶだけで、値は漏れない（spec の User Story 4 の Why this priority）
- 退けた案: 末尾のスラッシュを外して比べる（取得元ごとに URL の形の決まりが違い、根拠を持てない）

## R7 ページ送り

- 決めたこと: 1 ページ 50 件。`?page=N`（1 から）でページを選ぶ。51 件を読み、51 件目があれば次のページへのリンクを出す。`page` が 1 以上の整数でなければ 1 ページ目として読む。上限は 1,000 ページ（これより大きい値は 1,000 として読む）
- 理由: spec の Assumptions の「ページ送りの仕方」は実装のときに詰める。ADR-0016 の「表示の絞り込みを URL に書き込まない。クエリ文字列で指定された場合は初期状態として読む」に合わせ、パスに入れない。オフセットで送ると、読む間に行が足されたときに同じ行が 2 ページに出るが、設計原則 9 により、カーソルで送る形は件数が増えてから考える
- 上限の理由: constitution II（量の上限）。ページの番号が大きいほど D1 が読む行が増える
- 退けた案: カーソル（並びのキーを URL に入れる）。2 つ目の使い道が無い

## R8 画面の名前と URL

- 決めたこと: 既定（実装者、2026-11-09）: 画面の名前は「timeline」、URL は `/timeline`。トップ（`/`）は変えない
- 理由: #86「工事中を外し、timeline と note を公開する」が、一覧を timeline と呼ぶ。トップの「工事中」を外すかは #86 が持ち、2026-09-07 に「工事中を外すのは全部終わってからです」とオーナーが決めた（#67）。ADR-0016 はコレクション名で URL を作る
- 退けた案: トップを一覧に置き換える（#86 の決定を先取りする）

## R9 種類ごとの見せ方とリンク

- 決めたこと: 1 件ごとに、種類の名前・並びの日付・題・種類ごとの値を出す。リンクは次のとおり
  - note: `/notes/{slug}`。既定（実装者、2026-11-09）: 個別のページへリンクする
  - 外部の activity: 取得元の URL へ直接リンクする（FR-020）。取得元の名前（`SOURCE_LABELS`）を出す。分類（`activity_source.kind`）は DTO と `data-source-kind` 属性に持つ。埋め込みの分類も、この一覧ではリンクで出す
  - life event: `/life-events/{slug}`
  - 実績: `/projects/{slug}`。既定（実装者、2026-11-09）: 個別のページへリンクする。秘匿化した実績の `slug` は題から推測できない uid（001 の research.md の R6）で、個別のページも秘匿化した値で出す
  - 職歴: リンクしない（001 の plan.md の U9: 職歴は一覧の中で見せるだけで、職歴の個別のページを持たない）
- 本文: 実績と職歴の本文は一覧に出さない。秘匿化した実績・職歴だけ、本文の場所に「非公開」と出す（FR-013、001 の spec の FR-021）。理由: 001 の plan.md の U4（本文の書式）が決まっていないため、実績の個別のページも本文を出していない（`src/features/project/components/visitor-project.tsx`）
- note の説明文は、公開した版の説明文を出す（FR-006）
- 外部の activity の題が空のとき: 取得元の名前と URL のホスト名で出す（NFR-02 の一部欠損）
- 埋め込みで見せること: 既定（実装者、2026-11-09）: この一覧では埋め込みを読み込まない。理由: 外のサービスのスクリプトを読むと、表示速度（NFR-03〜NFR-07）と第三者への要求が増える。どの埋め込みで見せるかを取得元で決められるよう、DTO に `source` と `sourceKind` を持たせる（FR-019）
- 見た目: `design/guidelines.md` に従う。色はトークン（`text-muted-foreground` など）だけを使う。並びは `<ol>`、1 件は `<article>`、日付は `<time>`。リンクはネイティブの `<a>` で、フォーカスの位置を `focus-visible:outline-ring` で見せる（Inputs の Focus and selection・Keyboards）
- 退けた案: 種類ごとに別のカードの部品を作る（2 つ目の使い道が無い）

## R10 代表画像

- 決めたこと: 既定（実装者、2026-11-09）: 一覧に代表画像を出さない。ビューは画像の列（`card_media_id`・`image_url`）を持たない
- 理由: note の代表画像の配り方は #209 が持ち、外部の activity の画像の出し方は #186「URL カードの画像の出し方を決める」が決めていない。秘匿化した実績の画像は出せない（FR-013）。設計原則 3 により、出す値を絞ってから足す
- 退けた案: 外部の activity の `image_url` を直接 `<img>` で読む（第三者への要求と、LCP の要素が外のサーバーに依る）

## R11 職歴のスキル

- 決めたこと: 一覧に出すスキルは、実績につないだスキル（`project_skill`）だけにする。職歴には出さない
- 理由: 職歴のスキルは、同じ組織で期間が重なる実績から求める（001 の spec の FR-035）。その求め方は #208 のブランチ（`feature/208-career-resume-rest`）が作り、このブランチに無い。SQL のビューで同じ求め方を書き直すと、求め方が 2 か所に分かれる
- 依存: #208 がマージされた後に、職歴のスキルを足すかを決める
- 退けた案: ビューの中で期間の重なりを求める（求め方が 2 か所になる）

## R12 キャッシュ・404・状態

- 決めたこと: `/timeline` はキャッシュしない。`'use cache'`・`revalidate`・`dynamic` を書かず、`export const instant = false` で、描画を終えてから応答を返す（`src/app/life-events/[slug]/page.tsx` と同じ）。データで決まる 404 は無いので、`src/proxy.ts` は変えない
- 状態（NFR-02）:
  - データが無い: 「まだ何もありません」と出す
  - 読み込み中: 描画を終えてから応答を返すため、読み込み中の画面は持たない
  - 一部欠損: 外部の activity の題が空でも、その 1 件を出す（R9）
  - エラー: D1 から読めないときは投げ、500 の画面を出す（他の訪問者のページと同じ）。一覧は 1 つのビューを 1 回読むため、種類ごとに分けて一部だけ出す形は取らない
  - 範囲の外のページ: 0 件の画面に「最初のページへ」のリンクを出す
- 理由: spec の「後に回すと決まっているもの」に、公開の操作の後に見えるまでの時機とキャッシュの扱いがある（2026-10-22 のオーナーの承認）。それまでは次の要求から見える形にする。ADR-0040
- 退けた案: 種類ごとに 5 回読み、失敗した種類を除いて出す（ADR-0044 の「公開側はこのビューだけを読む」と合わない）

## R13 読み取り行数

- 決めたこと: 一覧の 1 回の読み取りが D1 でスキャンする行数を、`tests/workers/feed-repository.test.ts` の「1 ページを読むときにスキャンする行数を測る」が `meta.rows_read` で測り、値を検査に固定する。返る値は、5 種類を 1 件ずつ入れた D1 で 1 ページを読んだときのスキャン行数。本番の D1 で遅ければ、値を写して持つ形へ移す（ADR-0044 の Confirmation）
- 理由: constitution VI。計測の前に索引や写しを足さない
