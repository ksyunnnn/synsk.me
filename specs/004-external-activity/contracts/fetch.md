# Contract: 取得の処理

## 入口

`worker/index.ts` の `scheduled()`。Cron Triggers（`wrangler.jsonc` の `triggers.crons`、`0 * * * *`）が 1 時間に 1 回呼ぶ。`scheduledTime` の時（UTC）を 8 で割った余りで、1 つの枠を選ぶ（research.md の R6）。

| 余り | 枠 |
|---|---|
| 0 | `zenn_article` |
| 1 | `qiita_article` |
| 2 | `devto_article` |
| 3 | `medium_article` |
| 4 | `github_repository` |
| 5 | `speakerdeck_deck` |
| 6 | `connpass_event` |
| 7 | URL を指名した activity の取り直し |

## 一覧を取る枠の処理

読む → 計算 → 書く（docs/SOFTWARE_DESIGN.md）の順に行う。

1. 読む: その取得元の保存した activity（id・`external_id`・`url`・`published_at`）
2. 取る: 取得元の関数が `FetchOutcome`（`{ ok: true, items, isComplete }` か `{ ok: false, reason }`）を返す
3. 失敗なら、`fetch_result` に失敗と理由を書いて終える。activity は書き換えない（FR-014）
4. 計算する: 消えたかを確かめる候補（research.md の R7）を選ぶ
5. 確かめる: 候補の URL を 5 件まで取り、`gone`・`present`・`unknown` を得る
6. 書く: 1 つの `batch()` で、項目の書き込み（値が変わった行だけ）・消えた行の削除（5 件まで）・`fetch_result` の成功を送る

## URL を指名した activity の取り直しの枠

1. 読む: URL を指名する取得元の activity を id の順に並べ、`floor(scheduledTime / 8 時間)` から決まる位置の 5 件
2. 取る: それぞれの oEmbed を取る
3. 書く: 取れたものは題と代表の画像の URL だけを書き換える。404・410 なら行を消す。取得元ごとの `fetch_result` を書く

## 検査

- 単体: 取得元ごとの関数が、固定した応答を `FetchedItem` に詰め替える。状態コード・待ち時間切れ・大きさの超過で `ok: false` を返す
- 単体: 候補の選び方（件数が決まっている取得元で、一覧の最も古い公開日より古いものを選ばない）と、消す件数の上限
- 単体: 取得のユースケースが、作り物の Repository と作り物の取得元で、失敗したときに activity を書き換えず、取得の結果に失敗を書く
- workerd: 書き込みが同じ項目を 2 行にしない（ID・URL の両方）。値の変わらない行を書かない。`last_succeeded_at` が失敗の間も残る。URL を指名した activity の取り直しが `published_at` を書き換えない
