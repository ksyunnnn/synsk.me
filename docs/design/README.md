# Design Guidelines

> [PRINCIPLES.md](../PRINCIPLES.md) の Design Principles を具体的な視覚言語として展開

---

## Structure

```
Design Principles（なぜ）     ← ../PRINCIPLES.md
         ↓
Foundations（何を）           ← このディレクトリ
   ├── Colors
   ├── Typography
   └── Spacing
         ↓
Components（どう）            ← 将来追加
   ├── Buttons
   ├── Cards
   └── ...
```

---

## Documents

| Document | Description | Status |
|----------|-------------|--------|
| [foundations.md](./foundations.md) | 色・フォント・スペース | ✅ Colors, Typography, Spacing |
| [reference-kbkbkb.md](./reference-kbkbkb.md) | UI参考サイト分析（kbkbkb.co） | ✅ |
| [pencil-mcp-guide.md](./pencil-mcp-guide.md) | Pencil MCP 運用ガイド | ✅ |
| [typography-comparison.html](./typography-comparison.html) | タイポグラフィ比較（ブラウザで開く） | ✅ |
| [font-pairing-comparison.html](./font-pairing-comparison.html) | フォントペアリング比較（ブラウザで開く） | ✅ |
| components.md | コンポーネント規約 | 将来追加 |

---

## .pen File Naming Convention

Pencil ファイルの命名規則。`{type}-{subject}-{detail}.pen` 形式で統一する。

### 構成要素

| 要素 | 役割 | 選択肢 |
|------|------|--------|
| **type** | ファイルの目的・段階 | `exploration`, `draft`, `spec`, `final` |
| **subject** | 対象 | `content`, `layout`, `component`, `screen` |
| **detail** | 詳細（省略可） | `patterns`, `direction`, `v1`, etc. |

### Type の定義

| Type | 意味 | 用途 |
|------|------|------|
| `exploration` | 探索・検討 | 複数案の比較、方向性の検討 |
| `draft` | 下書き | 単一案の作り込み途中 |
| `spec` | 仕様 | 確定したデザイン仕様 |
| `final` | 最終 | 実装に使う完成版 |
| `foundations` | 基盤 | デザイントークン（特殊） |

### 例

```
design/
├── foundations.pen                    # デザイントークン（特殊）
├── exploration-content-patterns.pen   # コンテンツ案の比較検討
├── draft-hero-layout.pen              # ヒーローセクションの下書き
├── spec-component-button.pen          # ボタンコンポーネントの仕様
└── final-homepage.pen                 # ホームページの最終版
```

---

## Design Tokens

このプロジェクトでは Tailwind CSS を使用しています。

Design Tokens は `tailwind.config.ts` で定義され、このドキュメントはその設計意図を説明します。

```
tailwind.config.ts  ←→  docs/design/foundations.md
      （実装）                  （意図・ガイドライン）
```

---

## Methodology

### Why → What → How

1. **Why（なぜ）**: Design Principles が判断基準を提供
2. **What（何を）**: Foundations が使う要素を定義
3. **How（どう）**: Components が組み合わせ方を示す

### References

- [Atomic Design](https://atomicdesign.bradfrost.com/) - Brad Frost
- [Design Tokens](https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421) - Nathan Curtis
- [Tailwind CSS Best Practices](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)
