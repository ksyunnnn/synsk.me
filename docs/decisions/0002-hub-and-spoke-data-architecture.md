---
status: accepted
date: 2026-01-31
decision-makers: synsk
---

# Hub-and-Spoke データアーキテクチャ

## Context and Problem Statement

synsk.me は複数のプラットフォーム（Zenn、GitHub、Qiita、dev.to 等）での発信活動を集約して表示するポートフォリオサイトである。

課題:
- 各プラットフォームのデータは手動で収集・更新している
- 活動履歴の可視化や分析ができていない
- データの一元管理ができていない

要件:
- 複数プラットフォームからのデータ取得（API/RSS）
- 活動履歴の蓄積と可視化
- 外部サービス依存を最小化
- 技術的な学習・実験の場としても活用

## Considered Options

* キャッシュのみ（ISR + Vercel KV）
* Supabase（PostgreSQL）
* SQLite
* DuckDB

## Decision Outcome

**synsk.me をハブとした Hub-and-Spoke モデルを採用する。**

> **分離の記録（2026-08-20）**: 本 ADR は当初「Hub-and-Spoke モデルの採用」と
> 「データストアに DuckDB を使用」という2つの決定を含んでいたが、
> [docs/adr/README.md](./README.md) が定める ADR の単位に反していたため、
> データストアの選定を [ADR-0007](./0007-duckdb-wasm-datastore.md) へ分離した。
> 本 ADR が扱うのは Hub-and-Spoke というモデル構造の決定のみである。
> 以降に残る DuckDB への言及は、分離前の検討記録として保持している。

### Hub-and-Spoke モデル

```
                    ┌─────────────────┐
                    │    synsk.me     │
                    │     (Hub)       │
                    │    + DuckDB     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │          │         │         │          │
   ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
   │  Zenn   │ │GitHub │ │Qiita  │ │dev.to │ │Medium │
   │  (RSS)  │ │ (API) │ │ (API) │ │ (API) │ │ (RSS) │
   └─────────┘ └───────┘ └───────┘ └───────┘ └───────┘
```

### DuckDB の採用理由（[ADR-0007](./0007-duckdb-wasm-datastore.md) へ分離）

> 以下は 2026-01-31 時点の検討記録。データストアの決定は ADR-0007 が最新である。

1. **埋め込み型**: 外部サービス（Supabase 等）への依存なし
2. **分析向き**: 列指向で集計クエリに強い
3. **JSON 直接クエリ**: API レスポンスをそのまま分析可能
4. **技術的興味**: 実際に使った経験を発信のネタにできる

### Consequences

* Good, because 複数プラットフォームのデータを一元管理できる
* Good, because 活動履歴の蓄積・可視化・分析が可能になる
* Good, because 外部サービスへの依存を最小化（DB は埋め込み型）
* Good, because DuckDB の実践経験を得られ、技術記事のネタになる
* Good, because 個人サイトを技術実験場として活用できる
* Bad, because データ量（数百件）に対して DuckDB はオーバースペック
* Bad, because 学習コストが発生する（DuckDB の習熟）
* Bad, because 実装の複雑度が「キャッシュのみ」より高い
* Bad, because DuckDB の WASM 版がプロダクション用途で安定しているか未検証
  * 対策: ビルド時に静的生成するパターンから始める
* Bad, because 外部 API のレート制限や仕様変更
  * 対策: エラーハンドリングとフォールバックを実装

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

> 以下の Option A〜D はデータストアの選択肢であり、決定は
> [ADR-0007](./0007-duckdb-wasm-datastore.md) へ分離した。分離前の検討記録として保持する。

### Option A: キャッシュのみ（ISR + Vercel KV）

外部 API からデータを取得し、ISR でキャッシュする。DB は使用しない。

- **Pros**: 最もシンプル、追加コストなし
- **Cons**: 履歴蓄積不可、外部 API 依存、分析不可

### Option B: Supabase（PostgreSQL）

外部の BaaS を使用してデータを永続化する。

- **Pros**: 実績あり、スケーラブル、リアルタイム機能
- **Cons**: 外部依存、コスト発生、個人サイトにはオーバースペック

### Option C: SQLite

軽量な埋め込み型 RDB を使用する。

- **Pros**: シンプル、実績豊富、Turso でエッジ対応可能
- **Cons**: 分析クエリは DuckDB に劣る、技術的な新鮮味が薄い

### Option D: DuckDB（採用）

分析特化の埋め込み型 DB を使用する。

- **Pros**: 分析向き、JSON 直接クエリ、WASM 対応、学習価値
- **Cons**: データ量に対してはオーバースペック

## References

- [DuckDB Documentation](https://duckdb.org/docs/)
- [DuckDB WASM](https://duckdb.org/docs/api/wasm/overview.html)
- [Hub-and-Spoke Model 設計検討](../archive/hub-and-spoke-model.md)
- [発信コンテンツ分析](../archive/content-analysis/07-cross-platform-synthesis.md)
