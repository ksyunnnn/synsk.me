# Data Model: 外部 activity の取得

表と列の正本は `migrations/` にある。ここは、この機能が使う表と、アプリケーションが守る決まりを置く。

## 表

| 表 | 持つもの | 正本 |
|---|---|---|
| `activity_source` | 取得元の名前（`source`）と分類（`kind`: `article`・`embed`・`life_event`・`other`） | 0004・0007。外部の取得元の行は 0021 |
| `activity` | 外部の activity と life event の 1 件 | 0004・0009（`slug`）・0020（`uid`） |
| `fetch_result` | 取得元ごとの最後の取得の結果 | 0004 |
| `media` | life event の画像の記録（`activity_id`）。003 の仕組みを使う | 0005 |

## activity の列の使い方

| 列 | 外部の activity | life event |
|---|---|---|
| `uid` | 管理画面の URL の識別子（0020） | 同じ |
| `source` | 取得元 | `life_event` |
| `external_id` | 取得元での ID。返さない取得元は NULL | NULL |
| `url` | 取得元の URL | NULL |
| `title` | 題 | 題（アプリケーションが必須にする。research.md の R10） |
| `description` | 使わない | 説明 |
| `image_url` | 代表の画像の URL（取得元が返すとき） | 使わない |
| `published_at` | 公開日時。URL を指名した・手で入力した activity はオーナーが入れた日（日本時間の 0 時） | NULL |
| `happened_on` | NULL | 起きた日 |
| `slug` | NULL | 訪問者向けの URL の識別子 |
| `card_media_id` | NULL | 代表画像（research.md の R11 が解けてから） |
| `created_at` | 初めて取り込んだ日時（FR-013） | 作った日時 |

## アプリケーションが守る決まり

- 取り込み方（一覧を取る・URL を指名する・手で入力する）は `src/features/activity/domain/source.ts` が取得元ごとに持つ。D1 に持たない（FR-004）
- 一覧を取る取得元の activity は、取得の処理だけが書き換え、管理画面からは書き換えも削除もしない（FR-022・FR-032）
- 取得の処理は、外部の activity と `fetch_result` だけを書き換え、life event を書き換えない（FR-032）
- URL を指名した activity の取り直しは、題と代表の画像の URL だけを書き換え、`published_at` を書き換えない（FR-012）
- 公開日の無い外部の activity は保存しない（FR-011）
- life event は題と起きた日を必ず持つ。リンク先を持たない（FR-024・FR-025）
- life event を消すときは、同じ `batch()` で、その life event の `media` を消す（FR-027）

## 状態

外部の activity も life event も、訪問者に見せない状態を持たない（FR-021・FR-026）。行があれば一覧の対象で、取得元で消えたと確かめた外部の activity は行を消す（research.md の R7）。
