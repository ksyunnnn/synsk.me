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
| [typography-comparison.html](./typography-comparison.html) | タイポグラフィ比較（ブラウザで開く） | ✅ |
| [font-pairing-comparison.html](./font-pairing-comparison.html) | フォントペアリング比較（ブラウザで開く） | ✅ |
| components.md | コンポーネント規約 | 将来追加 |

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
