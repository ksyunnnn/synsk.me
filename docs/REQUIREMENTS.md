# Requirements

> この文書は満たすべきことだけを書く。進捗と実装方法は書かない。

---

## FR-01: activity を永続化する
根拠: [ADR-0009](./adr/0009-external-data-sync.md)

## FR-02: 外部 activity を自動で取得し、永続化する
根拠: [ADR-0009](./adr/0009-external-data-sync.md)

## FR-03: career と project を永続化する
根拠: [ADR-0003](./adr/0003-content-data-model.md)

## FR-04: internal コンテンツに画像などのメディアを含められる
根拠: [ADR-0010](./adr/0010-content-storage-scope.md)

## FR-05: internal コンテンツに、公開前の下書き状態を持てる
根拠: [ADR-0008](./adr/0008-content-visibility.md)

## FR-06: 公開済みの activity を、データを保持したまま非公開にできる
根拠: [ADR-0008](./adr/0008-content-visibility.md)

## FR-07: career と project は、公開・限定公開・非公開の3段階を区別して保持できる
根拠: [ADR-0008](./adr/0008-content-visibility.md)

## FR-08: career と project は、公開できる値と公開できない値の両方を保持できる
根拠: [ADR-0008](./adr/0008-content-visibility.md)

## FR-09: 外部 activity を再取得しても、手で付けた情報が保持される
根拠: [ADR-0009](./adr/0009-external-data-sync.md)

## FR-10: internal コンテンツの過去の版を保持し、任意の版に戻せる
根拠: [ADR-0010](./adr/0010-content-storage-scope.md)

## FR-11: 永続化したデータを完全に削除できる
根拠: [ADR-0008](./adr/0008-content-visibility.md)

## FR-12: career と project から職務経歴書を出力できる
根拠: [ADR-0003](./adr/0003-content-data-model.md)

## NFR-01: 永続化したデータ全体を復元できる
根拠: なし

## NFR-02: データがない・読み込み中・一部欠損・エラーの各状態で画面が成立する
根拠: なし
