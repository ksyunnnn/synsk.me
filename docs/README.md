# Documentation

synsk.me プロジェクトのドキュメントハブです。

## Foundation Documents

| Document | Description |
|----------|-------------|
| [VISION.md](./VISION.md) | プロダクトのビジョン（Working Backwards形式） |
| [PRINCIPLES.md](./PRINCIPLES.md) | 意思決定の原則 |

## Guidelines

| Directory | Description |
|-----------|-------------|
| [adr/](./adr/) | Architecture Decision Records |
| [design/](./design/) | デザインガイドライン |

## Document Hierarchy

```
VISION.md
  │ "このプロダクトは何を実現するか"
  ↓
PRINCIPLES.md
  │ "判断に迷ったとき、何を優先するか"
  ↓
┌─────────────────────────────────────┐
│                                     │
↓                                     ↓
adr/                             design/
"なぜこの技術・構造を選んだか"    "どう見せるか"
```

## Language Policy

- ファイル名・見出し: 英語
- 本文: 日本語

## References

このドキュメント構成は以下の思想に基づいています:

- **Vision**: [Amazon Working Backwards](https://workingbackwards.com/)
- **Principles**: [Ray Dalio's Principles](https://www.principles.com/) + X over Y形式
- **ADR**: [Architecture Decision Records](https://adr.github.io/)
- **Design**: [Atomic Design](https://atomicdesign.bradfrost.com/) + [Design Tokens](https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421)
