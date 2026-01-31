# ADR-0002: Hub-and-Spoke データアーキテクチャ

- **Status**: proposed
- **Date**: 2026-01-31
- **Deciders**: Syunsuke Kobashi
- **Related Principles**: [../PRINCIPLES.md](../PRINCIPLES.md)

---

## Context

synsk.me は複数のプラットフォーム（Zenn、GitHub、Qiita、dev.to 等）での発信活動を集約して表示するポートフォリオサイトである。

現状の課題:
- 各プラットフォームのデータは手動で収集・更新している
- 活動履歴の可視化や分析ができていない
- データの一元管理ができていない

要件:
- 複数プラットフォームからのデータ取得（API/RSS）
- 活動履歴の蓄積と可視化
- 外部サービス依存を最小化
- 技術的な学習・実験の場としても活用

---

## Decision

**synsk.me をハブとした Hub-and-Spoke モデルを採用し、データストアとして DuckDB を使用する。**

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

### DuckDB の採用理由

1. **埋め込み型**: 外部サービス（Supabase 等）への依存なし
2. **分析向き**: 列指向で集計クエリに強い
3. **JSON 直接クエリ**: API レスポンスをそのまま分析可能
4. **技術的興味**: 実際に使った経験を発信のネタにできる

---

## Alternatives Considered

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

---

## Consequences

### Positive

- 複数プラットフォームのデータを一元管理できる
- 活動履歴の蓄積・可視化・分析が可能になる
- 外部サービスへの依存を最小化（DB は埋め込み型）
- DuckDB の実践経験を得られ、技術記事のネタになる
- 個人サイトを技術実験場として活用できる

### Negative

- データ量（数百件）に対して DuckDB はオーバースペック
- 学習コストが発生する（DuckDB の習熟）
- 実装の複雑度が「キャッシュのみ」より高い

### Risks

- DuckDB の WASM 版がプロダクション用途で安定しているか未検証
  - 対策: ビルド時に静的生成するパターンから始める
- 外部 API のレート制限や仕様変更
  - 対策: エラーハンドリングとフォールバックを実装

---

## Implementation Notes

### 実装フェーズ

1. **フェーズ 1.5 以降に実装開始**（デザインシステム確立後）
2. MVP では手動データで表示、その後 API 統合

### 優先順位

| 優先度 | プラットフォーム | 取得方法 |
|--------|-----------------|---------|
| 1 | GitHub | REST API + Webhook |
| 2 | Zenn | RSS（ISR） |
| 3 | Qiita | API v2（ISR） |
| 4 | dev.to | API（ISR） |
| 5 | その他 | 静的リンク |

### 技術スタック

- **DB**: DuckDB（ビルド時生成 or WASM）
- **データ形式**: JSON または Parquet
- **更新**: GitHub Webhook + ISR（1日1回）

---

## References

- [DuckDB Documentation](https://duckdb.org/docs/)
- [DuckDB WASM](https://duckdb.org/docs/api/wasm/overview.html)
- [Hub-and-Spoke Model 設計検討](../research/hub-and-spoke-model.md)
- [発信コンテンツ分析](../research/content-analysis/07-cross-platform-synthesis.md)
