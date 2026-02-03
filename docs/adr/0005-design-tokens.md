# ADR-0005: Design Tokens

- **Status**: accepted
- **Date**: 2026-01-27（初版）、2026-02-03（ADR化）
- **Deciders**: @ksyunnnn
- **Related Principles**: [余白 over 密度](../PRINCIPLES.md)、[息づき over 装飾](../PRINCIPLES.md)

---

## Context

synsk.me のリデザインにあたり、視覚言語の基盤となる Design Tokens を定義する必要がある。

PRINCIPLES.md で定めた「余白 over 密度」「息づき over 装飾」「対話 over 展示」を視覚的に体現するため、Colors・Typography・Spacing の各要素について意図的な設計判断を行う。

参考サイト: [kbkbkb.co](https://kbkbkb.co/) - 写真家 YOSHIYUKI KUBO のポートフォリオ。これらの原則を体現したデザイン。

---

## Decision

### 1. Colors: モノクロファースト

**Neutral Gray `hsl(0, 0%, x%)` を採用し、モノクロで構造を固める。**

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

**アクセントカラー**: Phase 2 終盤で検討。モノクロで構造を固めた後に必要性を判断する。

### 2. Typography: 囁くような軽やかさ

**Source Sans 3 + Noto Sans JP、Light 300 をベースとする。**

| 用途 | フォント | 配信 |
|------|----------|------|
| 英語 | Source Sans 3 | Google Fonts |
| 日本語 | Noto Sans JP | Google Fonts |

**選定理由**:
- Source Sans 3 と Noto Sans JP は同系統（Google/Adobe 共同プロジェクト）でウェイトバランスが自然に揃う
- 両フォントとも Light 300 に対応し、「囁くような軽やかさ」を表現可能
- Lato + Noto Sans JP / BIZ UDGothic も検討したが、font-weight: 500 での光学的ウェイト不一致（日本語が太く見える）が発生

**Type Scale**:

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

**Letter Spacing / Text Transform**:

| 用途 | letter-spacing | text-transform |
|------|----------------|----------------|
| 本文 | normal | none |
| 見出し | -0.01em | none |
| ラベル/ナビ | 0.08-0.1em | uppercase |

### 3. Spacing: 呼吸するレイアウト

**8px ベースのスケールを採用する。**

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 8px | インライン要素間、アイコンとテキスト |
| `sm` | 16px | コンポーネント内パディング |
| `md` | 24px | カード内余白、フォーム要素間 |
| `lg` | 48px | セクション間、大きなグループ分け |
| `xl` | 96px | ページセクション間、ヒーロー領域 |

**特徴**:
- 8px ベース（8, 16, 24, 48, 96）で倍数関係を維持
- lg（48px）以上を積極的に使用することで「余白 over 密度」を体現
- Tailwind の spacing scale と互換性あり（2, 4, 6, 12, 24）

### 4. Responsive Breakpoints

| Breakpoint | Value | Device |
|------------|-------|--------|
| `sm` | 480px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 976px | Desktop |
| `xl` | 1440px | Large desktop |

### 5. Icons

[ADR-0004: アイコンシステム](./0004-icon-system.md) を参照。

- UI アイコン: Phosphor Icons
- Platform アイコン: Simple Icons
- フォールバック: Phosphor Icons `Planet`

---

## Alternatives Considered

### Colors: Warm Gray / Cool Gray

- **Warm Gray**: 微かな暖かみを加える
- **Cool Gray**: 知的・クールな印象

**不採用理由**: 色が印象を左右しないことを優先。Neutral Gray が最も「主張しない」。

### Typography: Lato + Noto Sans JP

- **Pros**: Lato は人気のあるサンセリフ
- **Cons**: font-weight: 500 での光学的ウェイト不一致（日本語が太く見える）

### Typography: BIZ UDGothic

- **Pros**: 可読性が高い日本語フォント
- **Cons**: Source Sans 3 とのペアリングで違和感

---

## Consequences

### Positive

- PRINCIPLES.md との一貫性が保たれる
- 実装時の判断基準が明確になる
- kbkbkb.co で実証済みのアプローチを採用

### Negative

- Light 300 は一部の環境で細すぎる可能性
- モノクロのみでは強調表現に制限がある

### Risks

- アクセントカラーが必要になった場合、後から追加が必要

---

## Implementation

```css
/* src/app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --border: 0 0% 89.8%;

  --spacing-xs: 8px;
  --spacing-sm: 16px;
  --spacing-md: 24px;
  --spacing-lg: 48px;
  --spacing-xl: 96px;
}

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
spacing: {
  'xs': '8px',
  'sm': '16px',
  'md': '24px',
  'lg': '48px',
  'xl': '96px',
}
```

---

## References

- [kbkbkb.co](https://kbkbkb.co/) - 参考サイト
- [Google Fonts: Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)
- [Google Fonts: Noto Sans JP](https://fonts.google.com/specimen/Noto+Sans+JP)
- [ADR-0004: アイコンシステム](./0004-icon-system.md)

## Implementation Notes

### UI Stack を考慮した実装

デザイン実装時は **UI Stack**（5つの状態）を考慮する：

1. **Blank State** - データがない状態
2. **Loading State** - 読み込み中
3. **Partial State** - 一部データがある状態
4. **Error State** - エラー発生時
5. **Ideal State** - 理想的な状態（すべてのデータが揃っている）

各コンポーネントで5つの状態を設計し、ユーザー体験を一貫させる。

参考: [UI Stackとは？（Digital Identity）](https://digitalidentity.co.jp/blog/creative/ui-stack.html)

---

## Version History

| Date | Changes |
|------|---------|
| 2026-01-27 | 初期構造作成（foundations.md として） |
| 2026-01-27 | グレースケール（Neutral Gray）確定 |
| 2026-01-29 | Typography 確定: Source Sans 3 + Noto Sans JP, Light 300 |
| 2026-01-29 | Spacing 確定: 8px ベース |
| 2026-02-03 | ADR-0005 として再構成（design/foundations.md から移行） |
