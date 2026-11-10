# Research: 外部 activity の取得

plan.md の Technical Context の不明点と、作り方の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。決められないものは「未決」として理由と止める範囲を書く。未決の一覧は plan.md の「未決」が持つ。

## Contents

- R1 スキーマの前提
- R2 機能の切り方
- R3 取得元ごとの処理の形（Anti-Corruption Layer）
- R4 取得の流れと失敗の表し方
- R5 同じ項目の判定と書き方
- R6 取得元で消えた activity
- R7 取得元ごとに取れるもの
- R8 外への要求の上限
- R9 取得を走らせる時機
- R10 URL を指名する・手で入力する登録
- R11 life event の識別子と管理画面の URL
- R12 life event の画像
- R13 書き換えの経路とオーナーの判定
- R14 キャッシュと 404・403
- R15 認証情報

---

## R1 スキーマの前提

- 決めたこと: `migrations/0001`〜`0011` を当てたスキーマに、共有担当の migration（`activity.uid` と、取得元ごとの `activity_source` の行）を足したものを前提にする。004 は migration を書かない
- 既にあるもの: `activity`・`activity_source`・`fetch_result`（0004）、分類の 4 値 `article`・`embed`・`life_event`・`other`（0007）、life event だけが持つ `activity.slug` と部分 UNIQUE 索引 `activity_slug`（0009）、`media.activity_id` と代表画像の複合の外部キー（0004・0005）
- 足りないもの: `activity.uid`（ADR-0051。管理画面で 1 行ずつ開く life event と、URL を指名した・手で入力した外部の activity が使う）と、`life_event`・`unlisted` のほかの `activity_source` の行（0004 の注釈「外部の取得元の行は、取得の処理と一緒に入れる」）。U12（オーナーが登録する日付の持ち方）の答えによって列が増える
- 理由: migration は共有担当だけが変える（issue #219 の 2026-11-09 の宣言）

## R2 機能の切り方

- 決めたこと: 機能を `src/features/activity/` の 1 つにする。外部の activity と life event はどちらも `activity` の表の行で、表ごとに 1 つの Repository の実装のファイルを置く（001 の research.md の R3）。ユースケースと画面は外部の activity と life event で分ける
- Repository はインタフェースを外部の activity（`ActivityRepository`）と life event（`LifeEventRepository`）に分け、D1 の実装を `server/d1-activity-repository.ts` と `server/d1-life-event-repository.ts` に置く。どちらも `activity` の表を読み書きする。理由: 管理画面の uid から id を引く `findIdByUid` が、それぞれの行だけを指す。life event の文はどれも `source = 'life_event'` を条件にする
- 理由: ADR-0026 のディレクトリの形（`domain/`・`application/`・`components/`・`server/`）。一覧（005）は `activity` を読むが、別の機能の中で読み、004 の機能を import しない（ADR-0026 の「機能どうしは import しない」）
- 退けた案: `external-activity` と `life-event` の 2 つの機能に分ける。同じ表の行の型と書き方が 2 か所に分かれ、`source = 'life_event'` の判定が両方に要る

## R3 取得元ごとの処理の形（Anti-Corruption Layer）

- 決めたこと: 取得元ごとの取り方・取る先・後処理は、`src/features/activity/server/sources/<取得元>.ts` の 1 ファイルに書く（FR-004）。各ファイルは外部の応答（RSS の XML、JSON、oEmbed）を受け取ったその場で synsk.me の型 `FetchedItem`（URL・題・公開日時・取得元での ID・代表の画像の URL）に詰め替えて返す。外部の応答の型はそのファイルの外に出さない
- 型（domain に置く）: 一覧を取る取得元は `{ items: FetchedItem[]; isComplete: boolean }` を返す。`isComplete` は、取得元の項目をすべて取ったか（FR-018 の判定に使う）。URL を指名する取得元は、1 つの URL から `FetchedItem` か「取れない」を返す
- 取得元の一覧（取得元の名前・分類・取り込み方・担当のファイル）は `src/features/activity/domain/sources.ts` に `as const` で 1 か所に置く。分類は `activity_source.kind` に持ち、コードは D1 の値を正とする（FR-001・FR-002）
- 理由: `docs/SOFTWARE_DESIGN.md` の Anti-Corruption Layer、constitution VII。取得元の仕様が変わったときに直すファイルを 1 つに限る
- RSS の XML の読み方: workerd に `DOMParser` は無い（2026-11-09、`npm run test:workers` の中で `typeof DOMParser` が `undefined`）。`HTMLRewriter` はあるが HTML として読むため、RSS の `<link>`（HTML では空の要素）と CDATA を読めない。そこで package を足さず、RSS 2.0 の項目の子の要素だけを読む最小の読み手 `src/features/activity/server/sources/rss.ts` を持つ。使い手は Zenn・Medium・Speaker Deck の 3 つ（constitution IX）
- 退けた案: 取得元の取り方を `activity_source` の列に持つ。FR-004 が退ける

## R4 取得の流れと失敗の表し方

- 決めたこと: 取得のユースケース `refreshSources(deps, sourceNames, now, limits)` は、取得元ごとに「読む → 計算 → 書く」を行う。取得元どうしは `Promise.allSettled` で並べ、1 つの失敗でほかを止めない（FR-015）。結果は、取得元ごとの成否と理由の一覧で返し、投げない
  1. 読む: 取得元の項目を取る（R3）。保存した同じ取得元の activity を読む
  2. 計算: 足す行・直す行を `planRefresh` で、消す行を `planRemovals` で求める。どちらも外への要求も D1 も触らない（R5・R6）
  3. 書く: 1 つの取得元の書き込みと `fetch_result` の 1 行を、1 回の `batch()` で書く
- 取得に失敗した取得元では、activity を 1 行も書き換えず、`fetch_result` だけを書く（FR-014）。`last_succeeded_at` は前の値を残す（FR-016）
- 3 の `batch()` が失敗したとき（例: 取得元の値が activity の CHECK に反する。同じ項目が応答に 2 回あるときは、`planRefresh` が 1 つにする）は、`batch()` が `fetch_result` の行も戻す。そこで、その取得元の `fetch_result` に失敗と理由を別の 1 文で書き直す。成否に関わらず取り直した取得元ごとに `fetch_result` を書くため（FR-016）
- 理由: `docs/SOFTWARE_DESIGN.md` の「失敗の表し方」と「読む → 計算 → 書く」、constitution IV。`batch()` は 1 文が失敗すると全体を戻す（[D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)、001 の research.md の R2）ので、1 つの取得元の書き込みが途中で止まらない
- 退けた案: すべての取得元を 1 回の `batch()` で書く。1 つの取得元の書き込みの失敗で、ほかの取得元の結果も戻る（FR-015 に反する）

## R5 同じ項目の判定と書き方

- 決めたこと: 取得元が ID を返すときは `(source, external_id)` で、返さないときは `(source, url)` で同じ項目を判定する（FR-008）。スキーマの `UNIQUE (source, external_id)` と部分 UNIQUE 索引 `activity_source_url` が最後の守り
- URL で判定するときは、取った URL と保存した URL の両方を共有の `normalizeWebUrl`（`src/shared/domain/web-url.ts`）で揃えてから比べ、揃えた値で書く（`src/features/activity/application/plan-refresh.ts` の `urlKey`）。揃えると同じ値になる保存した行が 2 つあれば、保存した値が揃えた値と同じ行を同じ項目とする（もう一方を揃えた値に直すと UNIQUE に当たる）。揃えるのはスキームとホスト名の大小・既定のポート・パーセントエンコード・フラグメントだけで、末尾のスラッシュとクエリは揃えない（理由はその関数の注釈）。一覧を取る取得元の URL は取得元の一覧がいつも同じ形で返すので、取得元ごとに揃え足すものは無い（Zenn は末尾にスラッシュを付けた URL を 308 で付けない URL へ移す。2026-11-09 実測）
- 書き方: 足す行は INSERT、直す行は値が変わった列だけを UPDATE する。値が変わらない行は書かない
- 公開日を返さない取得元（URL を指名する取得元）を取り直すときは、`published_at` を書かない（FR-012）
- `created_at` は初めて取り込んだ日時（FR-013、0004 の注釈）。UPDATE で書き換えない
- URL を指名する取得元の activity は、取得のユースケースで取り直さない。題などを取るのは登録のときだけ。取り直す要求の数が activity の数だけ増えるため（原則 2）。FR-012・SC-005 は、`planRefresh` が公開日の無い項目で `published_at` を書かない決まりと、URL を指名した activity の保存が日付をオーナーの入力の値だけで書くことで満たす
- 理由: spec の Assumptions「値が変わった activity だけを書くか」は、D1 の 1 日の書き込みの上限（10 万行）を条件に決める。変わった行だけを書けば、1 回の取得で書く行は、新しい項目と直った項目と `fetch_result` の 1 行に限られる。判断の値は R8 に置く
- 退けた案: 毎回すべての行を UPSERT する。変わらない行も書き込みに数えられる

## R6 取得元で消えた activity

- 決めたこと: 取得元で消えたと確かめた activity は、`activity` の行を消す（2026-11-09、PM の回答。印の列を足さない）。消した行は一覧の対象から外れ、消えたことを示す値も残らない（FR-017）
- 確かめ方は取得元ごとの処理が持つ（spec の Assumptions「実装のときに決める」）。この plan は次の型を決める
  - 一覧を取る取得元で `isComplete` が真のとき: 保存した activity のうち、取った一覧に無いものを、消えた候補にする。取った一覧が空なら候補にしない（取得元の誤りの兆しで、件数が上限より少ない取得元ではすべてを消してしまう）
- 頁を辿る取得元（Qiita の `Total-Count`、connpass の `results_available`）は、頁ごとに返す総数が 1 頁目と違えば `isComplete` を偽にする。頁を辿るあいだに項目が消えたり増えたりすると頁の境目がずれ、取らなかった項目を消えた候補にするため
  - `isComplete` が偽のとき（Zenn は 20 件、Medium は 10 件で打ち切る）: 一覧に無いことを候補の根拠にしない（FR-018）
  - URL を指名する取得元と、確かめる手段を持たない取得元: 自動では消さない。オーナーが synsk.me の側で削除する（FR-033）
  - `isComplete` が偽で、個別の URL で確かめる手段を持つ取得元（Zenn・Speaker Deck）: 一覧に無い activity の URL を 1 本ずつ取り直す。続けて 2 回 404 が返った行を消えた候補にする。1 回目の 404 では消さず、404 が続いた回数を 1 にする。2xx なら残っている。ほか（5xx・待ち時間・大きさ・ほかの 4xx・取り直しの失敗）は判定せず、消さない（FR-020）。2xx と判定できない応答は回数を 0 に戻す。理由: 1 回の 404 は取得元の一時の誤りでも返ることがあり、消したものは取り消せない（2026-11-09、PM の決定。根拠は FR-017 と原則 2）。判定できない応答でも 0 に戻すのは、「続けて 2 回」を、間に判定できない回を挟まない 2 回にするため。回数を残すと、404 と判定できない回が交互に続いたときにも消し、消す方へ進む（原則 2）。回数を持つ列は共有担当の migration 0019 が足す `activity.consecutive_gone_count`（INTEGER NOT NULL DEFAULT 0、PR #271）。回数は取得の回をまたいで D1 に持ち越す。取得元の一覧に載った行は残っている証拠なので、回数を 0 に戻す。戻さないと、次に一覧から外れた回の 1 回の 404 で消える。実装は `src/features/activity/server/sources/gone.ts` と、`zenn.ts`・`speakerdeck.ts` の `checkGone`
  - 1 回の取得で取り直す本数に上限を持つ（R8 の表。本番の値は 0 で、取り直さない。本数は issue #280 で決める）。どれを取り直すかは、確かめたことの無い行を先に、次に `activity.gone_checked_at`（migrations/0015）の古い順に、同じなら公開日の古い順に選ぶ（`src/features/activity/application/plan-removals.ts` の `pickGoneChecks`）。取り直した行のうち消さなかった行に、取り直した日時と 404 が続いた回数を書く（回数の D1 の読み書きは T048b）。404 が続いている行は、確かめたことの無い行より先に選ぶ。後に回すと、2 回目を確かめるまでに一覧に無いほかの行をすべて回る
  - 取り直すときはリダイレクトを辿らない。移った先の 404 は元の URL が消えた証拠にならず、3xx は判定しない
  - `gone_checked_at` は確かめる順を決めるための日時で、消えた印ではない。消えたと確かめた行は、ほかの消えた行と同じく行ごと消す。一覧（005）は `gone_checked_at` を読まない
  - 取得元が条件付きの要求に 304 を返した回（R9）も取り直す。一覧に載らない古い記事を消しても RSS は変わらず、304 が続くため。一覧の中身が無いので、前の回までに一覧に無いとして確かめたことのある行（確かめた日時を持つ行）から同じ順で選ぶ。一覧に載っている行を選ぶと、回数を回をまたいで持つので、一時の 404 が 304 の回に 2 回続いただけで一覧に載っている行を消す
  - 消えたと確かめた行（続けて 2 回 404）も、消す候補の上限（下の項）に数える。上限を超えた回は 1 件も消さない。その回に確かめた行の回数は 0 に戻す（取得元の誤りの兆しで、回数を残すと次に候補が上限に収まった回に 1 回の 404 で消す）
- 上限: 1 回の取得で 1 つの取得元から消す件数に上限を設ける。消す候補が上限を超えた回は 1 件も消さず、`fetch_result.reason` に止めた旨を書く。次の回も同じなら同じく止め、オーナーが確かめる（FR-019。2026-11-09、PM が原則 2 から導いた）。理由: 一度に多く消えるのは取得元の誤り（空の一覧が返るなど）の兆しで、消したものは取り消せない。値は R8。計算は `src/features/activity/application/plan-removals.ts`
- 取得の結果をオーナーに見せる画面は持たない（plan.md の「spec が決めないものの扱い」）。止めた旨は `fetch_result.reason` に書くだけ
- 個別の URL を取り直したときの応答の実測（2026-11-09、`curl` で `-A 'synsk.me (+https://synsk.me)' -L` を付けた）: Zenn はある記事が 200、無い記事（作り物の URL）が 404。Speaker Deck もある資料が 200、無い資料が 404。Medium は、ある記事（`/p/<ID>`）も無い記事も 403 を返す。Medium は個別の URL で判定できないので、自動では消さない（FR-020）。Zenn と Speaker Deck で、オーナーが消した記事・資料が 404 を返すかは、消したものが無いので確かめていない（無い URL での 404 から推測している）
- 判定できないとき（取得の失敗、応答の形の誤り、消す候補が上限を超えた回）は消さない（FR-020）
- 理由: ADR-0052（ADR-0045 を置き換える）。行を消す形は、印を持つ列と、一覧の側で印を見る条件を足さずに済む（原則 9）。REQUIREMENTS.md の FR-11（永続化したデータを完全に削除できる）にも合う
- 退けた案: 消えた印の列を持ち、一覧の側で除く。005 の一覧の取り出しに条件が 1 つ増え、印を見落とした画面から消えた activity が出る
- 退けた案: 確かめる順に `updated_at` を使う。`updated_at` は行を書き換えた日時で、確かめただけの回に進めると意味が変わる。`gone_checked_at` だけの更新では `updated_at` を進めない（migrations/0015 のトリガ）

## R7 取得元ごとに取れるもの

正本は PR #47 の検証記録（`docs/scraps/external-api-verification.md`、ブランチ `feature/external-api-verification`、2026-09-02 実測）。YouTube は spec の Assumptions（2026-11-04 実測）。この表は取り込み方の決定に要る列だけを写す。

| 取得元 | 取り込み方（ADR-0052） | 分類（spec の Assumptions） | 取る先 | 同じ項目の判定 | `isComplete` | 公開日 |
|---|---|---|---|---|---|---|
| Zenn | 一覧を取る | 記事 | RSS `https://zenn.dev/ksyunnnn/feed` | URL（guid が URL と同じ） | 偽（20 件固定） | `pubDate` |
| Qiita | 一覧を取る | 記事 | REST `/api/v2/users/ksyunnnn/items` | ID | 真（`total-count` まで頁を辿ったとき） | `created_at` |
| dev.to | 一覧を取る | 記事 | REST `/api/articles?username=ksyunnnn` | ID | 真（空の頁まで辿ったとき） | `published_at` |
| Medium | 一覧を取る | 記事 | RSS `https://medium.com/feed/@ksyunnnn` | ID（guid） | 偽（10 件固定） | `pubDate` |
| GitHub | 一覧を取る | その他 | REST `/users/ksyunnnn/repos` | ID | 真（`per_page` 未満の頁まで辿ったとき） | `created_at`（2026-11-10 にオーナーが決めた。[issue #219 のコメント](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6761262936)） |
| Speaker Deck | 一覧を取る | 埋め込み | RSS `https://speakerdeck.com/ksyunnnn.rss` | URL（guid が URL と同じ） | 偽（全件を返すかを検証記録が確かめていない） | `pubDate` |
| connpass | 一覧を取る | その他 | REST v2 `/users/ksyunnnn/attended_events/` | ID | 真（`results_available` まで辿ったとき） | `started_at` |
| Spotify | URL を指名する | 埋め込み | oEmbed | URL | — | 返さない |
| X | URL を指名する | 埋め込み | oEmbed | URL | — | 返さない（検証記録は `html` から投稿日が読めるとするが、ADR-0052 は公開日を取れないとする。ADR-0052 に従う） |
| CodeSandbox | URL を指名する | 埋め込み | `/embed/<id>` の OG メタ（非公式） | URL | — | 返さない |
| YouTube | URL を指名する | 埋め込み | oEmbed | URL | — | 返さない |
| CodePen | すべて手で入力する | 埋め込み | なし（全経路 403） | URL | — | 手で入力 |
| 登録していないサイト | 未決（U11） | その他 | — | URL（FR-005） | — | 手で入力 |

- Qiita の 1 頁は 20 件にする。項目が本文の全文を持ち、`per_page=100` の頁は 941 KB だった（2026-11-09、77 件を実測）。R8 の 1 本の応答の大きさの上限（1 MB）の内側に収めるため
- 頁を辿る取得元（Qiita・dev.to・GitHub・connpass）で、R8 の要求の数の上限に当たって辿るのを止めたときは、`isComplete` を偽にする。上限で止めた一覧に無い activity を消す候補にしないため（FR-018・FR-020）
- 注意（検証記録から）: dev.to は User-Agent が空だと 403 を返し、Workers の `fetch` は既定の User-Agent を付けない。CodeSandbox は無い ID でもサイト既定の OG を 200 で返すので、`og:title` が既定値なら「取れない」とする。GitHub の `pushed_at` は null がありうる（公開日に使わない）。Medium の `link` は問い合わせの部分を除いて使う。connpass は API キーが必須で、要求は 5 秒に 1 回まで
- URL を指名する取得元の応答の実測（2026-11-09、`curl` で作り物の URL を指名した）: Spotify と YouTube の oEmbed は無い項目で 404。CodeSandbox の `/embed/<id>` は無い ID でも 200 で、`og:title` は `CodeSandbox`。取得元ごとの処理は、項目が無いことを表す 4xx（400・401・404・410）と、題を読めない応答（CodeSandbox は `og:title` が `CodeSandbox`）を「取れない」（null）にし、ほかの 4xx（bot の challenge の 403、429 など）・5xx・上限を超えたとき・リダイレクトで別のホストへ移ったときは失敗にする
- X の oEmbed は題の項目を持たない（検証記録の「フィールド」）。題の扱いは U11「取得元が題を返さない URL を指名したときの扱い」が決まってから作る
- issue #177「CodePen と CodeSandbox を手で登録できるようにする」は CodeSandbox を手で入力するとするが、spec の Assumptions と ADR-0052 は URL を指名するとする。spec に従う（2026-11-09、PM の回答）

## R8 外への要求の上限

- constitution II は、外への発信と費用のかかる処理に、量と回数の上限の値を plan に書くよう求める。spec の Assumptions も「上限の値は plan が持つ」とする
- 本番の値は `src/features/activity/domain/limits.ts` の `PRODUCTION_REFRESH_LIMITS` と `SOURCES_PER_RUN`。表の「状態」の列が、オーナーが決めた値か案の値かを示す

| 上限 | 値 | 状態 | 理由 |
|---|---|---|---|
| 1 回の取得で 1 つの取得元に出す要求の数 | 10 本 | 2026-11-10 にオーナーが決めた（[issue #219 のコメント](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6765032920)） | Qiita の未認証の上限は 60 回/時/IP、GitHub は 60 回/時/IP（検証記録）。Workers は共有の IP から出る |
| 1 本の要求の待ち時間 | 10 秒で打ち切り、失敗にする | 2026-11-10 にオーナーが承認した | 応答しない取得元で取得全体を待たせない（FR-015） |
| 1 本の応答の大きさ | 1 MB（1,048,576 バイト）で打ち切り、失敗にする | 2026-11-10 にオーナーが承認した | Qiita の 1 頁は 214 KB、Medium の RSS は 87 KB（検証記録） |
| 1 回の取得で 1 つの取得元の一覧に無い URL を取り直す本数（R6） | 0（取り直さない） | 未定。issue #280 で決める | 取り直すたびに外への要求が 1 本増える。`gone_checked_at` の古い順に回すので、本数が少なくても順に確かめる |
| 1 回の取得で 1 つの取得元から消す件数 | 5 件 | 案。issue #280 で決める | FR-019。候補がこれを超えた回は 1 件も消さず、`fetch_result.reason` に書く |
| connpass の要求の間隔 | 5 秒に 1 回 | 申請の条件 | 検証記録（申請の条件） |
| Cron の実行の間隔 | 1 日 7 回。式は `0 0,3,7,10,14,17,21 * * *`（UTC、間は 3 時間と 4 時間の交互） | 2026-11-10 にオーナーが決めた（[issue #219 のコメント](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6764855303)） | 1 つの取得元を取り直す間隔は「実行の間隔 × 一覧を取る取得元の数（7）÷ 1 回の実行で扱う取得元の数」で、7 つの取得元を毎日 1 度ずつ回る。24 は 7 で割り切れないので、時の並びで間を揃える。式は 1 本にする（Cron Triggers はアカウントで 5 本まで） |
| 1 回の実行で扱う取得元の数 | 1 | 2026-11-10 にオーナーが決めた（同上） | R9 の解析の時間の実測の表で、Qiita の取得元ごとの処理だけで 4〜6 ms かかる。1 にすれば、取得元 1 つの解析と D1 の呼び出しだけが 1 回の実行に載る |
| 1 回の実行で出す要求の総数と、取得元への配り方 | 取得元 1 つに 10 本。D1 と合わせて 16 本以下、消し損ねた画像の突き合わせを足して 24 本以下 | 上の 2 行から決まる | Workers Free の 1 回の呼び出しの subrequest の上限 50 本（R9）は、外への要求と D1 の呼び出しを合わせて数える。1 つの取得元に 10 本では 7 つの取得元で外への要求だけで 70 本になり、超える |

- 値はユースケースに引数で渡し（`limits`）、単体の検査では作り物の値を渡す。本番の値は `src/features/activity/domain/limits.ts` の 1 か所に置く
- D1 の 1 日の書き込みの上限（10 万行、spec の Assumptions）: R5 の書き方で、1 回の取得が書く行は「新しい項目＋直った項目＋取得元の数」に限られる。1 日の実行の回数を n とすると、1 日に書く行は「新しい項目＋直った項目＋n × 1 回の実行で扱う取得元の数」（実行の前に順番を取る 1 文を含めると、その倍）で、n が 24 でも上限に届かない

## R9 取得を走らせる時機

- 決めたこと: Cron Triggers で定期的に取得する。`worker/index.ts` に `scheduled` を足して `refreshSources` を呼び、`wrangler.jsonc` に `triggers` を書く。管理画面の「取り直す」の操作は持たない（2026-11-09、オーナー。[issue #219 のコメント「取得を走らせる時機（004-external-activity の U10）と、epic 宛ての PR の CI の扱いをオーナーが決めた」](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6732950051)）
- 理由: オーナーが操作する回数が増えない。費用は無料枠の中に収める前提
- 退けた案: 管理画面の操作だけ、Cron と管理画面の操作の両方
- 更新が無いのに実行が回り続ける無駄を、次の 3 つで抑える
  1. 実行の間隔を長めにとる。値は R8 の表（U13）
  2. 条件付きの要求: 取得元が返した `ETag`（無ければ `Last-Modified`）を取得元ごとに持ち、次の実行で `If-None-Match`（`If-Modified-Since`）を付けて送る。304 が返れば中身を読まず、その取得元の activity を書かず、`fetch_result` を成功として書く。持つ列は `fetch_result` に無いので、共有担当に migration を頼む（data-model.md の「要る migration の変更」）
     - 新しい値は、その取得元の activity を書く `batch()` の中でだけ書く。値を持つのは、応答の中身をすべて書き終えた取得元だけにする
     - 書き終えた回のうち次のときは値を書かず、持っていた値を NULL にする: 上限で消さずに残した activity がある（`keptOverLimit` が 0 でない、FR-019）、公開日の欠けた項目を取り込まなかった。値を残すと、次の実行が 304 になり、残した分を取得元が変わるまで扱わない
     - 取得が失敗した回（`batch()` の失敗の後に `fetch_result` を書き直すとき、取り直しの前に順番を取る書き込みを含む）は、前の値を残す。前の値は書き終えた回の中身に対応するので、取得元が変わっていれば中身を返す
     - 条件を付けていない要求への 304 は、中身を取れなかった失敗にする
  3. 1 回の実行で外へ出す要求の数に上限を設け、超えたら止める（R8、U13、原則 2）
- 条件付きの要求は、1 本の要求で取得を終えた取得元にだけ使う: RSS の Zenn・Medium・Speaker Deck と、1 頁目で総数まで取り切った Qiita・GitHub。dev.to は空の頁まで辿る（R7）ため使わない。2 頁目以降を取った取得元では、1 頁目が変わらなくても後の頁が変わりうるため、持っていた値を消し、次も中身を取る。下の実測は `per_page=1` で測ったもので、本番の要求の URL とは違う
- 実測（2026-11-09、`curl` で `-A 'synsk.me (+https://synsk.me)'` を付け、1 回目の応答の値を 2 回目の要求に付けた）

| 取得元 | 1 回目の応答が持つ値 | 2 回目の応答 |
|---|---|---|
| Zenn（RSS） | `Last-Modified` | 304 |
| Qiita（`per_page=1`） | `ETag`（弱い） | 304 |
| dev.to（`per_page=1`） | `ETag`（弱い） | 304 |
| Medium（RSS） | どちらも無い | 200（毎回中身を取る） |
| GitHub（`per_page=1`） | `ETag`（弱い） | 304 |
| Speaker Deck（RSS） | `ETag`（弱い） | 304 |
| connpass | 未測（API キーが無い） | 未測 |

- GitHub は、`Authorization` ヘッダを付けた条件付きの要求が 304 を返したとき、primary rate limit に数えない。`GITHUB_TOKEN` が無い環境（R15）では 304 も 60 回/時/IP に数える（[Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)）
- Workers Free の上限（[Workers の Limits](https://developers.cloudflare.com/workers/platform/limits/)、2026-11-09 に読んだ）: Cron Triggers はアカウントで 5 個、1 回の Cron の実行の CPU 時間は 10 ms、1 回の呼び出しの subrequest は 50 本。subrequest は「A subrequest is any request a Worker makes using the Fetch API or to Cloudflare services like R2, KV, or D1」（同じ頁）で、D1 の呼び出しも数える。外への要求を待つ時間は CPU 時間に数えない（同じ頁）。CPU 時間は応答を読んで詰め替える処理に掛かるので、実装の後に測る（原則 6）
- CPU 時間が 10 ms を超えると、取得元ごとの失敗ではなく実行の全体が止まり、残りの取得元の `fetch_result` が書かれない（FR-015・FR-016 を満たさない）
- 決めたこと（2026-11-09、PM）: 1 回の実行で扱う取得元を分ける。実行ごとに、取り直したことの無い取得元を先に、次に `fetch_result.fetched_at` の古い順に、上限の数まで選び、残りを次の回へ送る（`src/features/activity/application/pick-sources.ts`、原則 2・4）。`fetched_at` は成否を問わず書く（`refreshSources`）ので、失敗し続ける取得元がほかの取得元の順番を奪わない
- 選んだ取得元は、取り直す前に順番を取る: 取得の結果に「取り直しを始めて終わらなかった」と失敗を書き（`recordFetchFailure`。`fetched_at` が進み、`last_succeeded_at` は残る）、取り直し終えたら結果で上書きする。CPU 時間の上限で実行が止まると `refreshSources` は結果を書けず、順番を取らないと、その取得元が毎回先に選ばれ、ほかの取得元を取り直さなくなる
- 上限は取得元の数で持つ。本番の Worker では CPU だけを使うあいだ `performance.now()` と `Date.now()` が進まない（[Performance and timers](https://developers.cloudflare.com/workers/runtime-apis/performance/)）ため、実行の中で CPU 時間を測って止めることはできない。数の値は U13（R8）
- 解析の時間の実測（2026-11-09 に取った実データを作り物の `fetcher` で渡し、取得元ごとの処理の `fetchListing` を 30 回ずつ回した）。`wrangler dev` と同じ workerd ではタイマーが CPU の処理でも進む（同じ頁）。workerd の値は 1 ms 刻み

| 取得元 | 応答 | workerd（1 回目・中央値） | 手元の Node（中央値） |
|---|---|---|---|
| Qiita | 77 件・853 KB（`per_page=100` の 1 頁） | 6 ms・4 ms | 3.9 ms |
| GitHub（JSON を読むだけ） | 56 件・295 KB | 1 ms・1 ms | 1.0 ms |
| Medium | 50 KB | 0 ms・0 ms | 0.5 ms |
| Zenn | 30 KB | 1 ms・0 ms | 0.3 ms（1 回目 10.8 ms） |
| Speaker Deck・dev.to | 3 KB 以下 | 1 ms 以下 | 0.1 ms 未満 |
| connpass | 未測（API キーが無い） | 未測 | 未測 |

- 上の値は取得元ごとの処理（`fetchListing`）だけで、1 回の実行の全体（D1 の行の詰め替え・`planRefresh`・`batch()` の文の組み立て・isolate の立ち上がり）を含まない。Qiita は `per_page=100` の 1 頁で測っており、本番の要求（R7 の 20 件の頁）とは形が違う。1 回の実行で扱う取得元の数を 1 にして 10 ms に収まるかは、本番の値で確かめる

- 本番の 1 回ごとの CPU 時間は、Workers Logs の起動の記録の `$workers.cpuTimeMs` で読む。`wrangler.jsonc` の `observability.enabled` で記録を残す。Cron の起動の記録は、メッセージに Cron の式を持つ（[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)、2026-10-12 更新）。`$workers.cpuTimeMs` は Query Builder の絞り込みの項目に挙がる（[Query Builder](https://developers.cloudflare.com/workers/observability/query-builder/)、2026-10-02 更新）。Free の記録の枠は、2026-11-30 までは 1 日 20 万件で 3 日残る（Workers Logs の頁）。2026-12-01 からはほかの観測の製品と共通の 1 日 0.5 GB で 7 日残り、枠に達すると次の 00:00 UTC まで記録を取り込まない（[Observability の Pricing](https://developers.cloudflare.com/observability/pricing/)、2026-10-25 更新）。サイトへの要求も起動ごとに 1 件の記録を書き、同じ枠を使う（Workers Logs の頁の Invocation Logs）。全体の Metrics の「CPU Time per execution」（[Metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)）は、Cron の実行だけに絞れるかが書かれていない
- 消し損ねた画像の突き合わせ（src/shared/server/sweep-orphaned-media.ts）は、同じ Cron の起動のうち UTC の 0 時の回だけで回す（`worker/scheduled.ts`）。subrequest は取り直しと合わせて 1 回 24 本以下で 50 本に収まるので、7 回とも回せる。0 時の回だけにするのは、CPU 時間を足す回を 7 回のうち 1 回にするため。突き合わせは画像を置いてから 1 日を過ぎるまで消さないので、1 日 1 回にしても消えるのが遅れるのは 1 日以内になる。取り直しを先にし、突き合わせで実行が止まっても取り直しの結果は書き終えている。回は `controller.scheduledTime`（[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、2026-10-17 更新）の UTC の時で見分ける。式は 1 本なので、`controller.cron` では見分けられない

## R10 URL を指名する・手で入力する登録

- URL を指名する取得元: オーナーが取得元と URL と日付を送る。システムは R3 の処理で題などを取り、取れれば保存する（FR-009）。日付が無ければ保存しない（FR-011）
- 手で入力する取得元（CodePen）: オーナーが URL・題・日付を送り、そのまま保存する（FR-010）
- 登録していないサイト: 題を URL から取るか、手で入力するかが未決（U11）。spec の「取得元が題を返さない URL を指名したときの扱い」も U11 にまとめる
  - 案 (a) すべて手で入力する。推奨。理由: 任意の URL へ要求を出さずに済む（原則 2）。003 の URL カード（`link_preview`）と同じ取得を 2 か所に作らない（原則 9）
  - 案 (b) URL の OG メタから題を取る。003 の URL カードの取得と同じ処理を使う。機能どうしは import しない（ADR-0026）ので、その処理を `src/shared/` に移すことを共有担当に頼む
- オーナーが入れる日付の持ち方が未決（U12）。日付は暦の日付で、`activity.published_at` は日時の列（0004）
  - 案 (a) その日の UTC の 00:00（例: 2020-04-01 なら `2020-04-01T00:00:00.000Z`）を `published_at` に入れる。推奨。理由: migration が要らない。`sort_at` は文字列で比べるので、同じ日の life event の `happened_on`（`2020-04-01`）より後に並び、0004 の注釈「暦の日付は、同じ日の日時より前に並ぶ」と合う。UTC の日付として読めば、オーナーが入れた日付のまま出る
  - 退けた形: Asia/Tokyo の 00:00 を UTC にして入れる（`2020-03-31T15:00:00.000Z`）。前の日の値になり、同じ日の life event より前に並び、UTC で日付を出す画面では 1 日ずれる
  - 案 (b) 暦の日付の列を足す migration を共有担当に頼む
- URL は `src/shared/domain/web-url.ts` の `isWebUrl` で http か https だけを通す。URL を指名する取得元では、さらにその取得元のホストの URL だけを通す（任意のホストへ要求を出さない。原則 2）
- URL を指名する取得元では、オーナーが貼る URL の表記がゆれる。取得元ごとの処理が、同じ項目を指す表記を 1 つに揃えてから題を取り、揃えた URL を返す（2026-11-09 実測。どれも oEmbed が同じ項目を返した）
  - YouTube: `youtu.be/<ID>`・`m.youtube.com/watch?v=<ID>`・`www.youtube.com/shorts/<ID>`・`/live/<ID>`・`/embed/<ID>`・共有の印 `si` などの付いた形を `https://www.youtube.com/watch?v=<ID>` にする（`canonicalYouTubeUrl`）。`sources.ts` の YouTube のホストの URL だけを揃える。`list` の付いたプレイリストの中の再生は揃えない（動画 1 本の URL にすると、先頭の動画が同じ別のプレイリストが 1 つにまとまる）
  - Spotify: アプリの「共有」が付ける `si` を除く。ほかのクエリは残す（`canonicalSpotifyUrl`）
  - CodeSandbox: `/s/<id>`・`/embed/<id>`・`/p/sandbox/<id>` が同じ sandbox を指すかを確かめていないので、揃えない
  - X: 題の扱い（U11）が決まってから決める
- 登録していないサイトの URL は `normalizeWebUrl` だけで揃える。フラグメントを消すので、1 つのページの中の位置（`#` から後）で項目を分けるサイトでは、別の項目が同じ URL になり、後から登録する方が「同じ URL が既にある」で拒まれる（FR-005）。オーナーの登録していないサイトの候補として PR #47 の検証記録が挙げるのは TECHPLAY と eventdots の URL（記事の本文に 14 件）で、イベントごとに別のページだと推測する（URL の一覧は確かめていない）。登録していないサイトの登録は U11 で止まっているので、U11 を決めるときに合わせて決める
- 削除（FR-033）は、URL を指名した・手で入力した activity だけに出す。一覧を取る取得元の activity には削除の操作を持たない（FR-022）

## R11 life event の識別子と管理画面の URL

- 訪問者の URL: `/life-events/{slug}`。ADR-0048 の「コレクション名と識別子で表す」と、既にある `/projects/{slug}` の形に合わせる
- slug の作り方: 作るときに識別子を入れなければ、題や起きた日から推測できない値を入れる（FR-035）。形の検査と既定値は共有担当の `src/shared/domain/slug.ts` の `isSlug`・`newSlug`（`crypto.randomUUID()` の 36 文字。PR #222「書きかけの保持の部品と slug の検査を src/shared/ にまとめた」）を使う（2026-11-09、PM の回答）。重複は `activity_slug` の UNIQUE が拒む
- 管理画面の URL: `/dash/life-events/{uid}` と `/dash/activities/{uid}`。`activity.uid`（ADR-0051、DB が入れる 32 文字）を使い、主キーと slug を出さない。`src/shared/domain/uid.ts` の `parseUid`・`findIdByUid` を使う
- issue #219 の調査が挙げた「uid」の食い違い（FR-035 の uid は 36 文字、ADR-0051 の uid は 32 文字）: 前者は slug に入れる値、後者は `activity.uid` の列で、別の列である。004 では slug の既定値を「uid」と呼ばず「推測できない値」と書く
- 同時編集: 004 の spec は先に保存された画面の保存を止める要件を持たないため、作らない（constitution III）

## R12 life event の画像

- 決めたこと: 代表画像は `activity.card_media_id` で、その life event の `media` の行だけを指す（複合の外部キー、FR-029）。画像の記録は `media.activity_id` に持つ（FR-030）
- 画像の保存と配信は共有担当の `src/shared/server/media-storage.ts`（001 の T075）を使い、004 では作らない
- 形式と上限と経路: 001 の plan.md の U5 の決定（2026-11-09、issue #219 のコメント「U5 を Claude が決めた」）に従う。R2 の原本を Worker が見せてよいかを確かめてから変換せずに返す。JPEG・PNG・WebP・GIF を受け、1 枚 10 MB まで
- 1 つの life event が持つ画像は 1 枚まで（代表画像だけ）。新しい画像を登録すると前の画像の行と R2 のものを消す。1 回の `batch()` で、新しい `media` の行を入れ、`activity.card_media_id` を新しい行に書き換え、前の `media` の行を消す。その後に前の画像の R2 のものを消す。理由: spec は代表画像を 0 枚か 1 枚とし（FR-028）、説明の中に画像を置けるかを決めていない。constitution II の量の上限を、1 つの life event につき 10 MB に抑える
- 配る経路: `/life-events/{slug}/media/{画像}`。その life event の代表画像のときだけ返し、ほかは 404。life event は訪問者に見せない状態を持たない（FR-026）
- 消すとき（FR-027）: D1 の `media` の行、`activity` の行の順に 1 回の `batch()` で消し、その後に R2 のものを消す。R2 の削除が失敗しても、D1 から辿れる行は残らない。R2 に残ったものの扱いは共有担当の部品に合わせる

## R13 書き換えの経路とオーナーの判定

- 書き込みの Server Action は、何より先に `src/shared/server/author.ts` でオーナーを確かめる（ADR-0036、001 の research.md の R4）。オーナーでない呼び出しは何も書かない（FR-031、constitution I）
- 取得のユースケースは `activity` の外部の行と `fetch_result` だけを書く。life event の行（`source = 'life_event'`）を書く文を持たず、SQL の WHERE でも `source <> 'life_event'` を条件にする（FR-032）

## R14 キャッシュと 404・403

- `'use cache'`・`revalidate`・`dynamic` を書かない（constitution の Cacheability）
- 無い slug の `/life-events/{slug}` は `src/proxy.ts` が描画の前に `/life-events/{slug}/missing` へ rewrite する（404）。`/projects/{slug}` と同じ形
- `/dash/life-events/{uid}`・`/dash/activities/{uid}` の無い uid も `src/proxy.ts` が `missing` へ rewrite する。`/dash` の 403 と `no-store` は既にある

## R15 認証情報

- 決めたこと: 取得元の認証情報（`GITHUB_TOKEN`・`QIITA_ACCESS_TOKEN`・`CONNPASS_API_KEY`）は Worker の secret に置き、保管するデータに持たない（FR-004）。型は `src/shared/server/env.ts` に足す
- 欠けたとき: GitHub と Qiita は未認証で取る。connpass はキーが必須なので、欠けていれば要求を出さず、`fetch_result` に失敗と理由を書く（constitution II）
- 値の雛形は `.dev.vars.example` に足す
