# Architecture Decision Records

> 重要な意思決定を記録し、未来の自分（と他者）が「なぜ」を理解できるようにする

---

## What is an ADR?

ADR（Architecture Decision Record）は、アーキテクチャ上の重要な決定とその理由を記録するドキュメントです。

**記録すべきもの**:
- 技術選定（フレームワーク、ライブラリ）
- 設計パターンの採用
- 構造の変更
- トレードオフのある判断

**記録しなくてよいもの**:
- 自明な判断
- 可逆的で影響の小さい決定
- 実装の詳細

---

## ADR Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [0001](./0001-product-vision.md) | Product Vision and Principles | proposed | 2025-01-23 |
| [0002](./0002-hub-and-spoke-data-architecture.md) | Hub-and-Spoke Data Architecture | proposed | 2026-01-31 |

---

## How to Write an ADR

### 1. 新しいADRを作成

```bash
# ファイル名: NNNN-short-title.md
cp docs/adr/template.md docs/adr/0002-your-decision.md
```

### 2. テンプレートを埋める

[template.md](./template.md) を参照

### 3. ステータスを設定

| Status | Meaning |
|--------|---------|
| `proposed` | 提案中（レビュー待ち） |
| `accepted` | 承認済み（実装可） |
| `deprecated` | 非推奨（新規採用しない） |
| `superseded` | 置き換え済み（新しいADRを参照） |

### 4. PRINCIPLESとの関連を記載

ADRは [PRINCIPLES.md](../PRINCIPLES.md) に基づいて判断されるべきです。

---

## Principles for Writing ADRs

- **1つの決定に1つのADR**: 複数の決定は分割する
- **不変性**: 承認後は変更せず、新しいADRで置き換える
- **簡潔さ**: 判断に必要な情報のみ記載
- **タイムリー**: 決定時に記録（後から思い出すのは難しい）

---

## References

- [Architecture Decision Records](https://adr.github.io/)
- [Michael Nygard's Original Post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [AWS ADR Best Practices](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
