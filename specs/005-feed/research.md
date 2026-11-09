# Research: 一覧

plan.md の Technical Context の不明点と、作り方の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。決められないものは「未決」として理由と止める範囲を書く。未決の一覧は plan.md の「未決」が持つ。

## Contents

- R1 スキーマの前提
- R2 一覧の読み口の置き場
- R3 ビューの形と、migration の分け方
- R4 秘匿化と出してよい値
- R5 並びの順
- R6 訪問者向けの DTO
- R7 重なりの除外
- R8 ページ送りと読み取り行数
- R9 キャッシュと画面の状態

---

## R1 スキーマの前提

- 決めたこと: `migrations/0001`〜`0012` を当てたスキーマに、共有担当が書く一覧のビュー `activity_feed` の migration を足したものを前提にする。005 は自分の表を持たず、migration を書かない
- 既にあるもの: 職歴と実績と組織（0011）、syndication（0005）、note・note_revision・activity（0012 が作り直した）、activity_source（0007。004 の取得元の行は 0012 が入れる）。activity は並びの値 `sort_at`（`coalesce(published_at, happened_on)` の生成列）と索引 `activity_sort_at` を持つ（0004・0012）
- 理由: migration は共有担当だけが変える（issue #219 の 2026-11-09 の宣言）。一覧は元のデータを読み、写して持たない（spec の Assumptions、ADR-0046）
- 退けた案: 一覧のために値を写す表を持つ（ADR-0046 が退けた）

## R2 一覧の読み口の置き場

- 決めたこと: 種類ごとに一覧の形へ詰める部分（読み口）は、ビュー `activity_feed` の腕（UNION ALL の 1 つずつの SELECT）に置く。001（`src/features/project`・`career`）・003（`src/features/note`）・004（`src/features/activity` の取得と life event）のコードには、一覧のための読み出しを足さない。005 のコードは `src/features/activity/` の中に、一覧の名前を付けたファイル（`domain/feed.ts`・`domain/feed-repository.ts`・`application/list-feed.ts`・`server/d1-feed-repository.ts`・`server/feed-queries.ts`・`components/feed.tsx`）として置き、ビューだけを読む
- 理由:
  - ADR-0046 の Decision Outcome の「一覧」が、一覧を activity・note・project・career をつなぐビュー `activity_feed` で読み、公開側はこのビューだけを読み、公開中の note の決まりと秘匿化の決まりをビューの中に書くとする
  - ADR-0026 の依存の向きの 1「機能どうしは import しない」。一覧が `project`・`career`・`note` の Repository を呼ぶ形は取れない
  - ADR-0027 が「timeline は `activity/` の中の部品にする」とする
  - 004 の plan.md は「005 は `activity` を自分の機能の中で読む。004 は 005 のために読み出しを作らない」とし、003 の research.md の R3 は「一覧（005）は note を `activity_feed` のビューで読み、`src/features/note/` を import しない」とする。どちらとも合う
  - ファイル名を一覧の名前で分けるので、004 が `src/features/activity/` に置くファイル（`activity-repository.ts`・`d1-activity-repository.ts`・`queries.ts`・`actions.ts`・`deps.ts` など）と重ならない
- 共有の部品: 新しく `src/shared/` に足すものは無い（plan.md の「再利用する既存の部品」）
- 退けた案:
  - 各機能が一覧用の形を返す関数を持ち、005 がそれを集める。ADR-0026 の依存の向きの 1 に反する。ADR-0046 のビューと 2 か所に決まりが分かれる
  - `src/features/feed/` を新しく切る。ADR-0027 が timeline を `activity/` の部品とする

## R3 ビューの形と、migration の分け方

- 決めたこと: ビューの列と腕は [data-model.md](./data-model.md) の「一覧のビュー」が持つ。migration は腕を足すたびにビューを作り直す（`DROP VIEW` と `CREATE VIEW`）形で、4 本に分ける。M1 は職歴と実績の腕、M2 は note の腕、M3 は外部の activity と life event の腕、M4 は転載先と一致する外部の activity の除外。番号とファイル名は共有担当が付ける
- 理由: issue #219 の進め方が、005 を 001 のデータだけの細い 1 本で先に通し、一覧の読み口を決めてから 003・004 の種類を足すとする（Walking Skeleton）。腕ごとに migration を分けると、各段階が失敗する検査から始められる。SQLite のビューは `ALTER VIEW` を持たず、変えるときは消して作り直す（[CREATE VIEW](https://sqlite.org/lang_createview.html)、2026-11-09 に確認）
- 腕の列の型: 腕ごとに同じ位置の列の型を揃え、使わない列は型を揃えた `NULL` を置く。ADR-0046 の Consequences が、腕の式の affinity が揃わないと全行を読むとするため。読み取り行数は R8 で測る
- 退けた案: 1 本の migration で 5 種類をまとめて作る。003・004 の種類を足す前に一覧の読み口を確かめる段階が無くなる

## R4 秘匿化と出してよい値

- 決めたこと:
  - サイトに載せる行だけを腕が読む（`status = 'published'`）。学歴の腕を持たない（FR-001・FR-004）
  - 秘匿化した職歴・実績の腕は、`title_masked` に `project.title_masked`、`organization_name_masked` に `organization.name_masked` を出し、`title`・`organization_name` を `NULL` にする。`description`・`url`・`card_media_id` と画像は列に出さない（FR-012・FR-013）。秘匿化しない行は `title`・`organization_name` に実際の値を出し、`_masked` の列を `NULL` にする（FR-014）。実際の値と秘匿化した値を同じ列に混ぜない（`docs/SOFTWARE_DESIGN.md` の「列の名前を意味ごとに1つにする」。2026-11-09 に PM が決めた）
  - 秘匿化した職歴・実績が、秘匿化した組織名の無い組織を指すときは、その行を出さない。001 の research.md の R5（2026-11-04 のオーナーの決定。DB のトリガを足さないため、取り出すときにも条件にする）と同じ条件で、実績のページの `VISITOR_VISIBLE`（`src/features/project/server/d1-project-repository.ts`）と揃える
  - 本文は、秘匿化した行では伏せた見た目で出す。001 の spec の FR-021（本文の場所に「非公開」と出す）に従い、画面が `isMasked` を見て決まった文字を出す。本文の中身も、本文が空かどうかも DTO に入れない（001 の contracts/visitor-project.md と同じ）
  - Repository の実装も、種類ごとに出す項目を列挙して DTO に詰める（constitution の Allowlist Visibility）。ビューと Repository の 2 段で、出してよい値だけが画面に渡る
- 理由: spec の FR-015、ADR-0029（取り出すときに確かめる）、ADR-0028（DTO）、ADR-0046（秘匿化の決まりはビューの中に書く）
- 退けた案: 全列を読んで画面で外す（ADR-0029 が退けた）

## R5 並びの順

- 決めたこと:
  - ビューは並びの値 `sort_at` を文字列で持つ。職歴と実績は `started_on`（暦の日付）、note は `note.created_at`（日時）、外部の activity と life event は `activity.sort_at`（0004 の生成列）を使う（FR-007・FR-009）
  - Repository の実装は `ORDER BY sort_at DESC, <種類の順>, item_number DESC` で読む。種類の順は `src/features/activity/domain/feed.ts` の 1 つの `as const` の配列に置き、SQL の `CASE` をその配列から作る。同じデータを読むたびに同じ順になる（FR-010）
  - 種類の順は仮の順（note・外部の activity・life event・実績・職歴）で作る。spec は「並びの日付が同じとき、どの種類を先に並べるか」を決めないため（plan.md の U2、2026-11-09 の PM の回答）。決まったら配列だけを直す
  - note は作成日で並べ、公開の操作で並びを変えない（FR-008）。`note.created_at` は公開で変わらない列（0005・0012）
- 未決: 暦の日付と日時が同じ日のときの順と、日の境目の時刻帯（spec の「決定が無く」）。0004 の `sort_at` は、暦の日付を同じ日の日時より前に並べる（文字列の比べ方で、日の境目は UTC になる）。オーナーが入れる日付を `published_at` にどう入れるか（004 の plan.md の U12）に左右されるため、その答えを待つ（plan.md の U3）。止める範囲は、種類をまたいで同じ日の順を確かめる検査（FR-011、SC-004 の同じ日の組）
- 退けた案: 種類の順をビューの列に持たせる。順を直すたびに migration が要る

## R6 訪問者向けの DTO

- 決めたこと: 一覧の 1 件の形 `FeedItem` は、種類で分けた型にし、[contracts/visitor-feed.md](./contracts/visitor-feed.md) が項目を列挙する。並べる値は、spec が UI を考えるときに決めるとするため、spec の受け入れの場面が求める最小の値にする（種類・題・組織名・肩書・実績の種類・期間・note の説明文・取得元と分類・取得元の URL・並びの日付）。使ったスキル・代表画像・個別のページへのリンク・秘匿化しない行の本文は、決まるまで入れない（plan.md の U4・U5・U7）
- 主キー（`item_number`）は DTO に入れない。並べる SQL の中だけで使う。React の key は並びの位置で付ける。ADR-0048 が主キーを外に出さないとし、RSC の応答には key も含まれるため
- 理由: constitution の Allowlist Visibility、設計原則 9（見せ方が決まっていない値を先に持たない）
- 退けた案: ビューの全列を DTO に通す。見せ方が決まる前に、出す値が増える

## R7 重なりの除外

- 決めたこと: 外部の activity の腕は、公開で削除していない note の転載先（`syndication.url`）と `activity.url` が一致する行を出さない（FR-016）。note が下書きか削除なら除かない（FR-016 の後半）。一致は文字列の完全一致で比べる
- 未決: 一致とみなす条件（末尾のスラッシュ・問い合わせの部分の違いなど。spec の「決定が無く」）。決まるまで完全一致にする（plan.md の U6）
- 理由: ADR-0006 の「重複エントリの除外」。除く条件をビューに書くので、画面は除いた後の並びだけを受け取る（FR-015）

## R8 ページ送りと読み取り行数

- 決めたこと:
  - ページ送りは、件数を決めた番号のページ（`?page=2`）で行う。並びの位置で区切り（`LIMIT`・`OFFSET`）、主キーを URL に出さない（ADR-0048「主キーは URL に出さない」）。最後のページの先の番号は 200 で返し、項目を並べない。2 ページ目より先で 0 件のときは「まだ何もない」を出さず、1 ページ目へのリンクを出す
  - 1 ページの件数は、D1 で読み取り行数（`meta.rows_read`）と表示の速さを測ってから決める。職歴と実績だけの段階（tasks.md の Phase 3）は件数が少ないため区切らず、外部の activity を一覧の画面に出す前（tasks.md の Phase 5）に区切る。計測には外部の activity の腕（M3）が要る
  - 読み取り行数を測るのは ADR-0046 の Confirmation。遅ければ写して持つ形に移すことになり、ADR-0046 を覆すので PM に伝える
  - 1 ページの件数は仮の値の 20 にする（plan.md の U8）。下の計測で、読み取り行数は 1 ページの件数で変わらないため、件数は見た目で決める値になる
- 計測（2026-11-09、手元の workerd の D1。`@cloudflare/vitest-plugin` の miniflare で、本番の D1 ではない）:
  - データ: 外部の activity 500 件、life event・公開の note・職歴・実績を各 50 件。並ぶ項目は合わせて 700 件
  - 5 つの種類を読む一覧の文（`ORDER BY sort_at DESC, 種類の順, item_number DESC`）を、`LIMIT` なし・`LIMIT 20`・`LIMIT 50`・`LIMIT 20 OFFSET 600` で 5 回ずつ流した
  - `meta.rows_read` はどれも 2,102 で、`meta.duration` は 0〜2 ミリ秒
  - `EXPLAIN QUERY PLAN` では、各腕の表を読み通し（`SCAN`）、全体を一時の B-tree で並べ替える。`LIMIT` を付けても読む行は減らない
  - 速さの面では、写して持つ形に移す必要を示す値は出ていない。移すかの判断はこの文書でしない
- 費用の懸念（issue #87「D1 の使用量が無料枠を超えないようにし、超過を検知する」）:
  - 1 回の一覧の表示で読む行は、並ぶ項目の全体の件数に比例する。上の計測では項目 1 件あたり約 3 行
  - D1 の Workers Free の読み取り行数の上限は 1 日 500 万行（[D1 の Pricing](https://developers.cloudflare.com/d1/platform/pricing/)、2026-11-09 に確認）。上の 700 件なら、一覧の表示 1 日約 2,378 回で上限に達する。項目が N 件なら約 500 万 ÷ 3N 回
  - ADR-0040 のエッジのキャッシュが本番で HIT を確かめているのは `/` だけで、`/` は `'use cache'` のページである。一覧のページは R9 のとおり `'use cache'` を使わず要求ごとに D1 を読むので、エッジのキャッシュは一覧の読み取り行数を減らさない。一覧を `/` に置くと（plan.md の U1）、`/` の HIT を確かめる `scripts/verify-deploy.mjs` の検査が通らなくなる（推測。vinext のデプロイ時の判定を確かめていない）
- 理由: spec の Assumptions「ページ送りの仕方」は実装のときに詰める。設計原則 6（測って直す）、設計原則 9。並びの値と主キーで区切る形（keyset）は読む行が少ないが、主キーか並びの値を URL に出すことになる
- 退けた案: 主キーを含む続きの印（cursor）を URL に出す。ADR-0048 に反する

## R9 キャッシュと画面の状態

- 決めたこと: 一覧のページは `'use cache'` を使わず、要求ごとに D1 を読む。`export const revalidate` と `export const dynamic` は書かない。データを読んでから決まる 404 は無いので、`src/proxy.ts` を変えない
- 画面の状態（NFR-02）: 0 件は「まだ何もない」の表示、D1 から読めないときは 500 の画面。読み込み中は、実績のページ（`src/app/projects/[slug]/page.tsx`）と同じく `export const instant = false` で D1 を `<Suspense>` の外で読み、描画を終えてから応答を返す。`loading.tsx` を置かない。流し始めた後は状態の番号が 200 のまま変わらず、500 を返せないため（ADR-0040）。取得元はビュー 1 つで、一部欠損に当たる分かれは無い。外部の取得に失敗した取得元の activity は前回の値で行に残る（004 の FR-014）ので、一覧には失敗が表れない
- 理由: constitution の Cacheability（ADR-0040）。キャッシュの扱いは spec が後に回す（2026-10-22 にオーナーが承認した）。キャッシュを持たないため、公開の操作や秘匿化の切り替えの直後の要求から新しい状態で出る
