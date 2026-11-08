# Research: 外部 activity の取得

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。spec の「決定が無く、この spec では決めない」項目と「実装のときに詰めるもの」に、実装者が置いた既定は「既定（実装者、2026-11-09）」と書く。既定の一覧は plan.md の「未決」が持つ。

## Contents

- R1 スキーマの前提と足す migration
- R2 機能の切り方と置き場
- R3 取得元の一覧と取り込み方
- R4 取得元ごとの取り方（境目の詰め替え）
- R5 同じ項目の判定と書き方
- R6 取得を走らせる時機と上限
- R7 取得元で消えたことの判定
- R8 取得の失敗と取得の結果
- R9 URL を指名する・手で入力する登録
- R10 life event
- R11 life event の画像
- R12 オーナーの判定・キャッシュ・404 と 403
- R13 取得の結果をオーナーに見せる画面
- R14 取得元の分類を変える手順

---

## R1 スキーマの前提と足す migration

- 決めたこと: `migrations/0004_create_activity.sql`・`0007`・`0009`（`activity.slug`）の `activity`・`activity_source`・`fetch_result` をそのまま使い、次の 2 つを足す
  - `0020_add_uid_to_activity.sql`: `activity` を作り直し、管理画面の URL に出す `uid` を足す。形と入れ方は `0011_add_uid_for_dash_url.sql` と同じ（16 バイトの乱数の 16 進表記を DB の DEFAULT が入れ、書き換えをトリガで拒む）
  - `0021_insert_activity_sources.sql`: 外部の取得元の行を `activity_source` に入れる（R3）。0004 の注釈「外部の取得元の行は、取得の処理と一緒に入れる」による
- 理由: life event の `slug` はオーナーが書き換えられる（spec の FR-035）。ADR-0051 は、管理画面で 1 行ずつ開くすべての表に `uid` を持たせ、主キーを URL とフォームに出さないとする。URL を指名した・手で入力した外部の activity も管理画面で 1 行ずつ開く（削除の確認）。NOT NULL・UNIQUE で式の DEFAULT を持つ列は ALTER TABLE ADD COLUMN で足せない（ADR-0051 の Consequences）
- 番号: #208〜#211 を並行して進めるため、この機能は 0020〜0024 を使う
- 退けた案: life event の `slug` を管理画面の URL に使う（書き換えると開いている管理画面の URL が別の行を指す。ADR-0051 が退けた）

## R2 機能の切り方と置き場

- 決めたこと: ADR-0027 の名前 `activity` で 1 つの機能 `src/features/activity/` にし、外部の activity と life event と取得をここに置く。取得元ごとの取り方は `server/sources/` に置く（R4）。Cron Triggers の入口は `worker/index.ts` の `scheduled()` で、`src/features/activity/server/scheduled.ts` を呼ぶ
- 理由: ADR-0027 は `activity` を機能の名前に挙げ、spec の Key Entities は外部の activity と life event を同じ `activity` の行とする。取得元ごとの処理は外部とやりとりするため `server/` に置く（constitution VIII）
- 退けた案: `life-event` を別の機能にする（ADR-0027 が挙げる名前に無く、同じ表の行を 2 つの機能が書くことになる）

## R3 取得元の一覧と取り込み方

- 決めたこと: `activity_source.source` の値と分類（spec の Assumptions、2026-10-28 のオーナーの決定）、取り込み方（ADR-0045）を次にする。取り込み方・取る先・認証情報の名前は `src/features/activity/domain/source.ts` と `server/sources/` のコードに持ち、D1 に持たない（FR-004）

| source | 分類（kind） | 取り込み方 |
|---|---|---|
| `zenn_article` | article | 一覧を取る（RSS、20 件で固定） |
| `qiita_article` | article | 一覧を取る（REST） |
| `devto_article` | article | 一覧を取る（REST） |
| `medium_article` | article | 一覧を取る（RSS、10 件で固定） |
| `github_repository` | other | 一覧を取る（REST） |
| `speakerdeck_deck` | embed | 一覧を取る（RSS） |
| `connpass_event` | other | 一覧を取る（REST、API キーが要る） |
| `x_post` | embed | URL を指名する（oEmbed） |
| `spotify_playlist` | embed | URL を指名する（oEmbed） |
| `youtube_video` | embed | URL を指名する（oEmbed） |
| `codesandbox_sandbox` | embed | URL を指名する（`/embed/<id>` の og:title） |
| `codepen_pen` | embed | すべて手で入力する |
| `unlisted`（0004 が入れた） | other | すべて手で入力する（既定、R9） |
| `life_event`（0004 が入れた） | life_event | オーナーが管理画面で作る |

- 取る先のアカウント名（`ksyunnnn`）は `server/sources/` の定数に置く。認証情報は Worker の secret（`GITHUB_TOKEN`・`QIITA_ACCESS_TOKEN`・`CONNPASS_API_KEY`）に置き、D1 に持たない（FR-004）。GitHub と Qiita は認証なしでも取れるため任意。connpass はキーが無ければ取らず、取得の結果に失敗と理由を書く
- 理由: 取れるもの・取れないものは PR #47 の検証記録（`docs/scraps/external-api-verification.md`、ブランチ `feature/external-api-verification`、2026-09-02 実測）による。TECHPLAY は取得の手段が無いため取得元を持たない

## R4 取得元ごとの取り方（境目の詰め替え）

- 決めたこと: 取得元ごとの関数は、外部の応答をその関数の中で `FetchedItem`（`externalId`・`url`・`title`・`publishedAt`・`imageUrl`）に詰め替えて返す。外部の応答の型は関数の外に出さない（constitution VII、docs/SOFTWARE_DESIGN.md の Anti-Corruption Layer）。外への要求は引数で受け取る `fetch` の関数で出す（Dependency Injection）。検査は外部のサービスを叩かず、固定した応答を返す関数を渡す
- RSS は Workers に XML の解析器が無いため、`<item>` の中の要素を取り出す小さな関数を `server/sources/rss.ts` に置く。使い手は Zenn・Medium・Speaker Deck の 3 つ（constitution IX の 2 つ目の使い道）
- 取得元ごとの値の取り方（PR #47 の検証記録の「フィールド」による）

| 取得元 | 識別に使う値（`externalId`） | 題 | 公開日 | 代表の画像 |
|---|---|---|---|---|
| Zenn | 返さない（`guid` は `link` と同じ値）。URL で判定 | `title` | `pubDate` | `enclosure@url` |
| Qiita | `id` | `title` | `created_at` | 無い |
| dev.to | `id` | `title` | `published_at` | `cover_image`、無ければ `social_image` |
| Medium | `guid`（`https://medium.com/p/<id>`） | `title` | `pubDate` | `content:encoded` の最初の `<img>` |
| GitHub | `id` | `name` | `created_at` | 無い（OG 画像の経路は文書に無く 429 を返すため使わない） |
| Speaker Deck | 返さない（`guid` は `link` と同じ値）。URL で判定 | `title` | `pubDate` | `media:content@url` |
| connpass | `events[].id` | `events[].title` | `events[].started_at` | 無い |

- URL は、Medium の `link` から問い合わせの部分を外す（PR #47 の検証記録）。ほかは返された値のまま使う
- GitHub はフォークしたリポジトリを取り込まない。アーカイブしたリポジトリは取り込む（オーナーの作ったものであるため。既定（実装者、2026-11-09））
- 題が空・URL が http(s) でない・公開日が読めない項目は、保存せずに数だけ取得の結果の理由に書く
- 既定（実装者、2026-11-09）: dev.to の要求には User-Agent を付ける（空だと 403。PR #47 の検証記録）。すべての取得元に同じ User-Agent `synsk.me (+https://synsk.me)` を付ける

## R5 同じ項目の判定と書き方

- 決めたこと: 取得元が ID を返す項目は `UNIQUE (source, external_id)`、返さない項目は部分 UNIQUE 索引 `activity_source_url`（0004）で 1 行にする。書き込みは `INSERT … ON CONFLICT … DO UPDATE … WHERE` で、題・URL・代表の画像の URL・公開日のどれかが変わった行だけを書き換える（FR-008、spec の「取得のとき、値が変わった activity だけを書くか」）
- 1 回の取得の書き込みは 1 つの `batch()` で送る。`batch()` は「Batched statements are SQL transactions」で、Worker の 1 回の呼び出しの問い合わせの数に 1 回と数える（[D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)、2026-11-09 に確認）
- 書き換える文は `updated_at` も同じ文で入れる。入れないと `activity_updated_at` のトリガ（0004）が同じ行をもう 1 回書き、`meta.changes` と書き込みの行数が 2 になる（`tests/workers/activity-repository.test.ts` で確かめた）
- 理由: 値が変わらない行を書かないと、D1 の 1 日の書き込みの上限（10 万行）に取得の回数が効かない
- 退けた案: 取り直すたびに全件を書く（書き込みの数が取得の回数に比例する）

## R6 取得を走らせる時機と上限

- 既定（実装者、2026-11-09）: Cron Triggers（`triggers.crons`）で 1 時間に 1 回走らせ、1 回に 1 つの枠だけを取る。枠は一覧を取る 7 つの取得元と、URL を指名した activity を取り直す枠の 8 つで、`scheduledTime` の時（UTC）を 8 で割った余りで選ぶ。各取得元は 8 時間に 1 回取り直す
- 上限（constitution II）

| 何の | 上限 |
|---|---|
| 1 回の呼び出しで外へ出す要求 | 一覧 1 回と、消えたかを確かめる要求 5 回まで（URL を指名した枠は 5 回まで） |
| 1 つの要求の待ち時間 | 10 秒（`AbortSignal.timeout`） |
| 1 つの応答の大きさ | 2,000,000 文字。超えたら読まずに失敗にする |
| 1 回の取得で保存する項目 | 100 件 |
| 1 回の取得で一覧から消す activity | 5 件（FR-019） |
| オーナーの 1 回の登録で外へ出す要求 | 1 回 |

- 書き込みの見積もり: 1 回の取得で書くのは、変わった項目（100 件まで）・消した項目（5 件まで）・取得の結果（1 行）で、1 日 24 回でも 2,544 行まで。D1 の 1 日の書き込みの上限 10 万行の 3% に収まる
- 理由: Workers Free の 1 回の呼び出しで出せる外への要求の数と、取得元のレート制限（GitHub と Qiita は認証なしで 1 時間に 60 回）に、1 回 1 枠なら収まる。Cron Triggers の設定と `scheduled()` の書き方は [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)（2026-11-09 に確認）。時刻は UTC で動く
- 手元での確かめ方: `wrangler dev --test-scheduled` で起動し、`/cdn-cgi/local/scheduled?cron=...` を開く（同じ文書）
- 退けた案:
  - 1 回ですべての取得元を取る。外への要求が 1 回の呼び出しで最大 7 + 35 回になる
  - オーナーが画面から取得を走らせるボタンを持つ。回数の上限を別に持つことになる（constitution IX）。要るときに足す

## R7 取得元で消えたことの判定

- 既定（実装者、2026-11-09。spec の「取得元で消えたと判定する条件」「404 の扱い」）: 次の 2 段で判定する
  1. 候補を選ぶ: 保存した activity のうち、取り直した一覧に無いもの。1 回の取得で返す件数が決まっている取得元（Zenn・Medium・Speaker Deck）と、一覧が全件でないと分かった取得元では、取り直した一覧の最も古い公開日より新しいものだけを候補にする。一覧に無いことだけでは消さない（FR-018）
  2. 確かめる: 候補の URL に GET を送り、404 か 410 を返したら消えたとみなす。2xx・3xx は残す。ほかの状態・通信の失敗・待ち時間切れは判定できないとして残す（FR-020）
- 1 回に確かめる候補は新しい順に 5 件、消すのは 5 件まで（FR-019、R6）
- 取得元で消えた activity は、`activity` の行を消す（spec の「保管するデータから消すか」の既定（実装者、2026-11-09））。一覧から消すことを、一覧の spec（005）の読み方に頼らずに満たせる。外部の activity は画像の記録（`media`）を持たない（0004 の CHECK）
- 一覧が全件か: Qiita はヘッダ `total-count` と返った件数、dev.to と GitHub は 1 ページの件数（100）より少ないか、connpass は `results_available` と `results_returned` で判定する
- 取得に失敗した取得元では、消えたかを確かめない（spec の Edge Cases）
- 理由: 取得元が非公開にした項目の URL は、訪問者から見て開かない。開かないことを確かめてから消せば、FR-020 の「誤って消すより残す」を守れる
- 退けた案: 一覧に無いことだけで消す。件数が決まっている取得元で古い項目を消す（FR-018 に反する）

## R8 取得の失敗と取得の結果

- 決めたこと: 取得の関数は、失敗を投げずに `{ ok: false, reason }` を返す（docs/SOFTWARE_DESIGN.md の「失敗の表し方」）。失敗した取得元の activity は書き換えない（FR-014）。1 回に 1 つの枠だけを取るため、1 つの取得元の失敗はほかの取得元の取得を止めない（FR-015）
- 取得の結果は `fetch_result` に取得元ごとに 1 行持ち、`INSERT … ON CONFLICT (source) DO UPDATE` で書く。`last_succeeded_at` は成功したときだけ書き換え、失敗が続いても残す（FR-016）
- 理由（成功のとき）: `reason` に取得した件数・書き換えた件数・消した件数を書く。失敗のとき: 状態コード・待ち時間切れ・大きさの超過・設定値の欠けを書く

## R9 URL を指名する・手で入力する登録

- 決めたこと: `/dash/activities/new` で、取得元・URL・日付・題（手で入力する取得元のときだけ）を受け取る
  - URL を指名する取得元: URL がその取得元のものかを確かめ、取得元の ID（投稿・プレイリスト・動画・sandbox の ID）を URL から取り出して `external_id` にする。oEmbed（CodeSandbox は `/embed/<id>` の og:title）を 1 回だけ取り、題と代表の画像を得る
  - 手で入力する取得元（CodePen・登録していないサイト）: URL・題・日付をそのまま保存する。CodePen は URL から pen の ID を取り出して `external_id` にする
- 既定（実装者、2026-11-09。spec の「取得元が題を返さない URL を指名したときの扱い」）: 取得元から題を取れなければ保存せず、理由を示す（constitution II の「判断に必要な値が欠けたら止める」。外部の activity に手で付ける値を持たない FR-021 にも沿う）
- 既定（実装者、2026-11-09）: URL を指名する取得元は、すべてオーナーが日付を入れる（FR-011）。X の oEmbed の `html` は日付を文で持つが、形が決まった値でないため読まない（constitution VII で外の形を内側に持ち込まない）
- 既定（実装者、2026-11-09）: 登録していないサイトは「すべて手で入力する」にする。任意のサイトのページから題を取る形は、取得元ごとに形が違い、確かめられない
- 日付の入れ方（既定（実装者、2026-11-09））: オーナーは暦の日付を入れ、`published_at` には日本時間（Asia/Tokyo）のその日の 0 時を UTC の日時で入れる（例: `2026-01-02` は `2026-01-01T15:00:00.000Z`）。管理画面は日本時間の暦の日付で出す。001 の経験年数が日本時間で月を数える（001 の research.md の R13）のと合わせる
- オーナーが書き換えられるのは、URL を指名した activity の日付と、手で入力した activity の URL・題・日付だけ（FR-031）。システムが一覧を取る activity は、管理画面で書き換えも削除もできない（FR-022）
- 削除（FR-033、ADR-0052）: URL を指名した activity と手で入力した activity だけを物理削除する。取り込み方の判定はコードの取得元の一覧で行い、D1 に印を持たない
- URL を指名した activity の取り直し（FR-012、spec の User Story 4 の 2）: R6 の 8 つ目の枠で、URL を指名した activity を id の順に 5 件ずつ巡り、oEmbed を取り直して題と代表の画像だけを書き換える。日付は書き換えない。oEmbed が 404 か 410 を返したら、R7 と同じく消えたとみなして消す

## R10 life event

- 決めたこと: `activity` の `source = 'life_event'` の行。題・説明・起きた日・識別子を持つ（FR-024・FR-025・FR-035）。リンク先の入力を持たない
- 識別子: 作るときは `crypto.randomUUID()` の値（36 文字、題や起きた日から推測できない）。001 の実績の識別子（001 の research.md の R6）と同じ作り方。オーナーは編集の画面で書き換えられる。形は 1〜100 文字の英小文字・数字・ハイフン（0009 の CHECK）、重なりは部分 UNIQUE 索引 `activity_slug` で拒む
- 既定（実装者、2026-11-09。spec の「life event の題を必ず入れるか」）: 題を必ず入れる。個別のページの `<title>` と見出し、一覧のリンクの文言に要り、空のリンクは読み上げで名前を持たない（docs/SOFTWARE_DESIGN.md の設計原則 5）
- 既定（実装者、2026-11-09。spec の「life event の説明の書式と、説明の中に画像を置けるか」）: 説明は書式を持たない文章で、空行で段落を分けて出す。説明の中に画像を置かない。note の本文の書式は暫定で Markdown（003 の spec）だが、life event の説明に書式の要件は無い（constitution IX）
- 既定（実装者、2026-11-09。spec の「life event の個別のページに出す値と見せ方」）: `/life-events/{slug}` に、題（見出しと `<title>`）・起きた日・説明を出す。代表画像は R11 が解けてから出す。見た目は `design/guidelines.md` に従い、001 の実績のページ（`src/features/project/components/visitor-project.tsx`）と同じ部品と余白にする
- 既定（実装者、2026-11-09）: 訪問者向けの URL のコレクション名は `life-events`（ADR-0048 は「コレクション名と識別子」とし、life event の名前を定めていない）
- 削除: 1 つの `batch()` で `activity.card_media_id` を空にし、その life event の `media` を消し、`activity` を消す（FR-027）
- 同時編集の楽観ロックは持たない。004 の spec に要件が無い

## R11 life event の画像

- 未決（依存）: 画像を収める仕組みと配る経路は 003 の spec が持つ（spec の Assumptions、FR-030）。003 の実装（#209）が並行して進むため、004 は画像の追加・代表画像の選択・配信を作らない。削除で画像の記録を消すこと（FR-027）は、`media` の行を消す SQL で満たし、検査で確かめる
- 止める範囲: FR-028・FR-029・FR-030、User Story 5 の 4・5。tasks.md に未チェックで残す

## R12 オーナーの判定・キャッシュ・404 と 403

- 決めたこと: 001 の research.md の R4（オーナーの判定）・R12（キャッシュと 404・403）・R17（管理画面の URL の識別子）と同じにする
  - `/dash/activities/*`・`/dash/life-events/*` の画面と Server Action は、先頭で `src/shared/server/author.ts` でオーナーを確かめる
  - `src/proxy.ts` は、`/life-events/{slug}` の無い識別子を `/life-events/{slug}/missing` へ、`/dash/activities/{uid}`・`/dash/life-events/{uid}` の無い uid をそれぞれの `missing` へ rewrite する
  - life event のページは `'use cache'` を使わない
- 理由: constitution の Cacheability、ADR-0036・ADR-0051

## R13 取得の結果をオーナーに見せる画面

- 既定（実装者、2026-11-09。spec の「取得の結果をオーナーに見せる画面を持つか」）: 持つ。`/dash/activities` に、取得元ごとの取得の結果（取り直した日時・成否・理由・最後に成功した日時）を表で出す。書き換える操作は持たない
- 理由: 取得の失敗を、一覧の表示と切り分けて知る手段が無いと、前回の値が出続けていることに気づけない（0004 の `fetch_result` の注釈）。`design/guidelines.md` の Feedback の「一部が取れなかったときは、取れた部分を出し、欠けたことを示す」

## R14 取得元の分類を変える手順

- 既定（実装者、2026-11-09。spec の「取得元の分類を変える手順」）: 管理画面の操作を持たず、`activity_source.kind` を書き換える migration を書く。分類を変えるのは取得元の追加と同じ頻度で、変えるとすべての activity の見せ方が変わる（spec の Edge Cases）ため、コードの変更と一緒にレビューを通す
- 退けた案: 管理画面で分類を選ぶ（使う回数に対して画面と検査が増える。constitution IX）
