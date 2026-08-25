# ADR-0009: 外部データを永続化し、手で付けた情報を再取得後も保持する

> この文書は決定を記録する。有効な要件は持たない。

- **Status**: accepted
- **Date**: 2026-08-21
- **Deciders**: synsk
- **Related Principles**: [余白 over 完成形](../PRINCIPLES.md)

---

## Context

[ADR-0002](./0002-hub-and-spoke-data-architecture.md) は Hub-and-Spoke モデルを採用した。取得方式の詳細は [hub-and-spoke-model.md](../research/archive/hub-and-spoke-model.md) にある。

ただし、そこに記載された統合アーキテクチャには保管の層が存在しない。fetcher が外部 API と RSS から取得し、aggregator が集約して、そのままページへ渡す。ISR でキャッシュし、Webhook で再検証する構成である。

この構成では、取得したデータに人が後から情報を付けられない。[ADR-0008](./0008-content-visibility.md) が定めた「削除せずに非公開へ戻す」を実現する場所がない。

判断の時点で、X（Twitter）の API は有料化されており、自動取得の対象から外れていた。[hub-and-spoke-model.md](../research/archive/hub-and-spoke-model.md) は埋め込み（手動選択）で扱うと記録している。

---

## Decision

**外部 activity を自動で取得して永続化し、人が後から付けた情報は再取得後も保持する。**

人が付ける情報には、コメント、表示分類の上書き、非公開への切り替えが含まれる。

---

## Alternatives Considered

### Option A: 取得して使い捨てる（記載済みの構成）

- **Pros**: 保管する場所が要らない。常に外部の最新状態を映す
- **Cons**: 人が後から付けた情報を置く場所がない

### Option B: 人が付けた情報だけを保持する

外部データ本体は毎回取得し、手で付けた分だけを保管して突き合わせる。

- **Pros**: 保管する量が最小になる
- **Cons**: 外部から消えたコンテンツが失われる。取得に失敗すると何も表示できない

### Option C: 外部データごと永続化する — 採用

- **Pros**: 外部から消えても残る。取得に失敗しても前回の値を出せる
- **Cons**: 保管する量が増える。外部の更新を取り込む処理が要る

---

## Consequences

### Positive

- 記事の削除やサービス終了に耐える
- 取得の失敗時に前回の値を出せる（`fetchStatus` の設計が活きる）
- 毎回すべてを取得する必要がなくなり、レート制限とビルド時間の消費が減る

### Negative

- 再取得したデータが同一のレコードかどうかを判定する処理が要る

### Risks

- **同一性の判定は外部の仕様に依存する。** 安定した識別子を外部が提供しているかはプラットフォームごとに異なり、こちらで決められない。判定できない場合、手で付けた情報を引き継げない

---

## References

- [ADR-0002: Hub-and-Spoke Data Architecture](./0002-hub-and-spoke-data-architecture.md)
- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [hub-and-spoke-model.md](../research/archive/hub-and-spoke-model.md)
