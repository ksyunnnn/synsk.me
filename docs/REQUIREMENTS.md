# Requirements

> この文書は満たすべきことだけを書く。進捗と実装方法は書かない。

---

## FR-11: 永続化したデータを完全に削除できる
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

## FR-13: 公開されたときの見た目を、公開前に確認できる
根拠: [ADR-0014](./decisions/0014-authoring-and-datastore.md)

## NFR-01: 永続化したデータ全体を復元できる
根拠: なし

## NFR-02: データがない・読み込み中・一部欠損・エラーの各状態で画面が成立する
根拠: なし

## NFR-03: 訪問者が到達する経路の LCP が、モバイルとデスクトップそれぞれの75パーセンタイルで 2,500 ミリ秒以内である。1,100 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-04: 訪問者が到達する経路の INP が、モバイルとデスクトップそれぞれの75パーセンタイルで 200 ミリ秒以内である。75 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-05: 訪問者が到達する経路の CLS が、モバイルとデスクトップそれぞれの75パーセンタイルで 0.1 以下である。0 を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-06: 訪問者が到達する経路の TTFB が、モバイルとデスクトップそれぞれの75パーセンタイルで 800 ミリ秒以内である。450 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-07: 訪問者が到達する経路の FCP が、モバイルとデスクトップそれぞれの75パーセンタイルで 1,800 ミリ秒以内である。900 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-08: 公開していない内容は、その公開範囲の外の人への応答に含まれない
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

## NFR-09: 認証を要する応答と、公開していない内容を含む応答は、どのキャッシュにも残らない。認証には、配信の環境全体にかける認証を含む。ただし、静的ファイルを、Cloudflare の静的ファイルの配信がエッジに持つことは除く
根拠: [ADR-0040](./decisions/0040-cache-components.md)、[ADR-0041](./decisions/0041-preview-no-store.md)
