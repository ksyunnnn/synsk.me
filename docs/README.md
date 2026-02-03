# Documentation

synsk.me プロジェクトのドキュメントハブです。

## Foundation Documents

| Document | Description |
|----------|-------------|
| [VISION.md](./VISION.md) | プロダクトのビジョン（Working Backwards形式） |
| [PRINCIPLES.md](./PRINCIPLES.md) | 意思決定の原則 |
| [ROADMAP.md](./ROADMAP.md) | プロジェクトの進行状況と次のステップ |

## Research

| Path | Description |
|------|-------------|
| [research/](./research/) | 調査ログ・参考分析 |

## Guidelines

| Path | Description |
|------|-------------|
| [adr/](./adr/) | Architecture Decision Records |

## Guides

| Path | Description |
|------|-------------|
| [pencil-mcp-guide.md](./pencil-mcp-guide.md) | Pencil MCP 運用ガイド |

## Document Hierarchy

```
VISION.md
  │ "このプロダクトは何を実現するか"
  ↓
PRINCIPLES.md
  │ "判断に迷ったとき、何を優先するか"
  ↓
ROADMAP.md ←── research/
  │ "今どこにいて、次に何をするか"    "調査ログ・参考分析"
  ↓
adr/
"なぜその選択をしたか（技術・設計・デザイン）"
```

## Language Policy

- ファイル名・見出し: 英語
- 本文: 日本語

## References

このドキュメント構成は以下の思想に基づいています:

- **Vision**: [Amazon Working Backwards](https://workingbackwards.com/)
- **Principles**: [Ray Dalio's Principles](https://www.principles.com/) + X over Y形式
- **ADR**: [Architecture Decision Records](https://adr.github.io/)
