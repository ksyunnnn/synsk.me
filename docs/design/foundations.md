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

**囁くような軽やかさ**: 文字が主張せず、静かに語りかける。

PRINCIPLES.md との関連:
- **余白 over 密度**: Light ウェイト（300）で視覚的な軽さを実現。太い文字は密度を上げる
- **息づき over 装飾**: 派手なウェイトバリエーションではなく、一貫した軽やかさで「呼吸感」を表現
- **対話 over 展示**: 押し付けがましくない文字で、読み手との対話を促す

参考: [kbkbkb.co](https://kbkbkb.co/) - 「余白」「息づき」「対話」を体現したポートフォリオサイト

### Font Family

| 用途 | フォント | 配信 |
|------|----------|------|
| 英語 | **Source Sans 3** | Google Fonts |
| 日本語 | **Noto Sans JP** | Google Fonts |

**選定理由**:
- Source Sans 3 と Noto Sans JP は同系統（Google/Adobe 共同プロジェクト）でウェイトバランスが自然に揃う
- 両フォントとも Light 300 に対応し、「囁くような軽やかさ」を表現可能
- Lato + Noto Sans JP / BIZ UDGothic も検討したが、font-weight: 500 での光学的ウェイト不一致（日本語が太く見える）が発生

**選定プロセス**: [font-pairing-comparison.html](./font-pairing-comparison.html) で比較検証

### Font Weight

**300 (Light) をベースとする。**

```
デフォルト: font-weight: 300
     ↓
実装中に強調が必要な箇所が出てきたら
     ↓
その時点で 400/500 を個別適用
```

**理由**:
- kbkbkb.co スタイルの核心は「全体が軽い」こと。部分的な太さの差ではなく、トーン全体の軽やかさ
- PRINCIPLES.md「実験 over 完璧な計画」に従い、まず 300 で実装して調整する
- 用途別の詳細な Token 定義は、実際のコンポーネント実装後に検討

### Type Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `heading-1` | 32-36px | 1.3 | ページタイトル |
| `heading-2` | 24-28px | 1.4 | セクション見出し |
| `body` | 18px | 1.8 | 本文 |
| `small` | 14px | 1.6 | 補足テキスト |
| `caption` | 12px | 1.5 | キャプション、ラベル |

**特徴**:
- 本文 18px は標準（16px）より大きめ。「余白 over 密度」を体現
- 行間 1.8 は広め。呼吸感を重視（kbkbkb.co 参考）
- 見出しはサイズ差で区別し、ウェイト差には頼らない

### Letter Spacing / Text Transform

| 用途 | letter-spacing | text-transform |
|------|----------------|----------------|
| 本文 | normal | none |
| 見出し | -0.01em | none |
| ラベル/ナビ | 0.08-0.1em | uppercase |

**理由**: ラベル/ナビは大文字 + 広めの letter-spacing で「静かな存在感」を表現（kbkbkb.co 参考）

### Implementation

```css
/* src/app/globals.css */
body {
  font-family: 'Source Sans 3', 'Noto Sans JP', sans-serif;
  font-weight: 300;
  font-size: 18px;
  line-height: 1.8;
}
```

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['Source Sans 3', 'Noto Sans JP', 'sans-serif'],
}
```

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
| 2026-01-29 | 0.3.0 | Typography 確定: Source Sans 3 + Noto Sans JP, Light 300 ベース |
