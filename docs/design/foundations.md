# Foundations

> 視覚言語の基盤となる要素

---

## Colors

### Design Intent

**モノクロファースト**: 色に頼らない情報設計を行う。

PRINCIPLES.md との関連:
- **余白 over 密度**: 強い色彩は視覚的密度を上げる。控えめな色は余白を生む
- **息づき over 装飾**: 色で気を引くのではなく、構造とコンテンツで語る
- **対話 over 展示**: 色が印象を左右しないことで、内容に集中できる

### Approach

```
Phase 1-2: グレースケール（Neutral Gray）で構造を固める
      ↓
Phase 2 終盤: 必要に応じてアクセントカラーを検討
```

### Grayscale Palette

**Neutral Gray** `hsl(0, 0%, x%)` を採用。

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `background` | hsl(0, 0%, 100%) | hsl(0, 0%, 3.9%) | ページ背景 |
| `foreground` | hsl(0, 0%, 3.9%) | hsl(0, 0%, 98%) | 本文テキスト |
| `muted` | hsl(0, 0%, 96.1%) | hsl(0, 0%, 14.9%) | 控えめな背景 |
| `muted-foreground` | hsl(0, 0%, 45.1%) | hsl(0, 0%, 63.9%) | 補足テキスト |
| `border` | hsl(0, 0%, 89.8%) | hsl(0, 0%, 14.9%) | 境界線 |

**選択理由**:
- 純粋なグレー = 色が主張しない
- 現在の globals.css と同一（変更コストゼロ）
- Warm/Cool グレーは「微かな暖かみ/知的さを加えたい」場合の選択肢だが、色が印象を左右しないことを優先

### Accent Color

[Phase 2 終盤で検討]

現時点では未定義。モノクロで構造を固めた後、以下を検討:
- アクセントカラーが必要かどうか
- 必要な場合、どの色相が適切か

### Implementation

```css
/* src/app/globals.css - 現状維持 */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --border: 0 0% 89.8%;
  /* ... */
}
```

---

## Typography

### Design Intent

[TODO: タイポグラフィに関する設計意図]

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `heading-1` | [TODO] | [TODO] |
| `heading-2` | [TODO] | [TODO] |
| `body` | [TODO] | [TODO] |
| `caption` | [TODO] | [TODO] |

### Font Family

- **Primary**: Lato (現在の設定)
- **Rationale**: [TODO: なぜこのフォントを選んだか]

---

## Spacing

### Design Intent

[TODO: スペーシングに関する設計意図]

### Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | [TODO] | [TODO] |
| `sm` | [TODO] | [TODO] |
| `md` | [TODO] | [TODO] |
| `lg` | [TODO] | [TODO] |
| `xl` | [TODO] | [TODO] |

---

## Responsive Breakpoints

現在の設定（`src/app/globals.css` より）:

| Breakpoint | Value | Device |
|------------|-------|--------|
| `sm` | 480px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 976px | Desktop |
| `xl` | 1440px | Large desktop |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-27 | 0.1.0 | 初期構造作成 |
| 2026-01-27 | 0.2.0 | グレースケール（Neutral Gray）確定、モノクロファーストアプローチ明記 |
