# Contract: 取得の処理

取得元から取り込む処理の入口と、取得元ごとの処理の形。作り方の理由は [research.md](../research.md) の R3〜R8 が持つ。

## 入口

`refreshSources(deps, sourceNames, now, limits): Promise<RefreshOutcome[]>`（`src/features/activity/application/refresh-sources.ts`）

- 入力: 取り直す取得元の名前の並び（一覧を取る取得元だけ）、今の日時、上限（research.md の R8）
- 出力: 取得元ごとの成否（data-model.md の `RefreshOutcome`）。投げない。1 つの取得元の失敗で、ほかの取得元を止めない（FR-015）
- 呼ぶもの: Cron Triggers の `scheduled`（`worker/index.ts`。U10 の決定、research.md の R9）
- 取得元が条件付きの要求に 304 を返したときは、その取得元の activity を書かず、`fetch_result` を成功として書く（research.md の R9）

## 取得元ごとの処理

`src/features/activity/server/sources/<取得元>.ts` が次のどちらかを書き出す。外部の応答の型はファイルの外に出さない（constitution VII）。

| 形 | 使う取り込み方 | 返す値 |
|---|---|---|
| `fetchListing(fetcher, limits): Promise<SourceListing>` | 一覧を取る | 項目の並びと、すべて取ったか（`isComplete`） |
| `fetchByUrl(fetcher, url, limits): Promise<FetchedItem \| null>` | URL を指名する | 1 件か、取れない（null） |

- `fetcher` は `fetch` と同じ形の関数を引数で受け取る（Dependency Injection）。単体の検査は作り物の応答を返す関数を渡し、外へ要求を出さない
- User-Agent `synsk.me (+https://synsk.me)` を付ける（検証記録の再現の手順。dev.to は空の User-Agent で 403）
- 待ち時間と応答の大きさの上限を超えたら失敗にする（research.md の R8）
- 応答の形が想定と違えば失敗にする。部分的に読めた項目で保存した値を消さない（FR-020）

## 書くもの

| 表 | 書く場合 |
|---|---|
| `activity`（外部の行だけ） | 取得が成功した取得元で、足す・値が変わった・消えたと確かめた行（R5・R6） |
| `fetch_result` | 成否に関わらず、取り直した取得元ごとに 1 行を上書きする（FR-016）。`activity` の書き込みの `batch()` が失敗したときも、失敗と理由を別に書く（research.md の R4） |

life event の行を書かない（FR-032）。
