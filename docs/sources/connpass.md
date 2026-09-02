# connpass

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `unconfigured` |
| 経路 | REST |
| エンドポイント | `https://connpass.com/api/v2/users/ksyunnnn/attended_events/` |
| 認証 | 必須（`CONNPASS_API_KEY`、ヘッダ名 `X-API-Key`） |
| 公式性 | 公式 |
| レート制限 | **5 秒に 1 リクエスト**（申請フォームの条件。OpenAPI が書く「1 秒 1 リクエスト」より厳しい） |
| 出典 | https://connpass.com/about/api/v2/ |
| 件数 | — |
| 実測日 | 2026-09-02 |

v1 は廃止済みで 403 を返す。公式 OpenAPI 3.1.0 が `https://connpass.com/about/api/v2/openapi.json` にあり、7 paths / 16 schemas / `APIKeyAuth` を定義している。

**キーは個人・コミュニティなら無償。** 審査は 5 営業日程度。訪問者の操作でリアルタイムに API を呼ぶ構成は承認されない場合があり、キーをブラウザや公開リポジトリに置くことは禁じられている。ビルド時に取得して静的化する形は、フォームの記入例と一致する。

## フィールド

API キーが無いため実データを持たない。型と必須の別は公式 OpenAPI の `EventListResponseSchema` による。

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `results_returned` | number | 認証時のみ | — | 必須 |
| `results_available` | number | 認証時のみ | — | 必須。総件数 |
| `results_start` | number | 認証時のみ | — | 必須 |
| `events` | Event[] | 認証時のみ | — | **必須**（任意ではない） |
| `events[].title` | string | 認証時のみ | — | |
| `events[].started_at` | string | 認証時のみ | — | |
| `events[].accepted` | number | 認証時のみ | — | |
| `events[].lat` / `lon` | number | 認証時のみ | — | 地図に置ける |
| `events[].hash_tag` | string | 認証時のみ | — | |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| キーなしでのすべて | 全エンドポイントで API キーが必須 | 実測 2026-09-02（401） |
| イベントページの HTML | `robots.txt` が全 UA に `Disallow: /`。許可は `/*.ics` と `/*/ja.atom` のみ | https://connpass.com/robots.txt |
| ユーザー単位の Atom | `/user/ksyunnnn/ja.atom` が 404 | 実測 2026-09-02 |

記事や登壇資料から抜いたイベント ID を `https://connpass.com/event/{id}.ics` に渡す経路は、キーを取得する前に使える唯一の合法な経路である。
