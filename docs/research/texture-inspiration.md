# Texture Inspiration: 質量と時間を感じる質感

> この文書は決定の正本ではない。決定は docs/adr/ にある。

## Contents

- Core Concept: 「質量」と「時間」
- Reference 1: Nani Translate Card
- Reference 2: kbkbkb.co
- 適用の方向性
- 関連する表現・美学
- 今後の検討
- 選定候補パターン（2026-02-03）
- プロトタイプファイル
- Version History

---

**記録日**: 2026-02-03
**目的**: リニューアルプロジェクトのデザインにおける質感・テクスチャの方向性検討

---

## Core Concept: 「質量」と「時間」

デジタルでありながら、物理的な存在感・重み・歴史を感じさせる質感。

### キーワード

- **質量感** - カードのような物理的な厚み・重み
- **展示物** - 美術館やギャラリーに飾られた作品のような佇まい
- **時間の堆積** - 古い絵画に埃がかかったような、年月を感じさせる表面
- **発見の喜び** - 倉庫で見つけ出すような、偶然の出会いの感覚

---

## Reference 1: Nani Translate Card

**ソース**: [assets/texture-ref-nani-translate.png](./assets/texture-ref-nani-translate.png)

### 観察された特徴

- **微細なグラデーション**: 上から下へ、明るい青から濃い青へのグラデーション
- **表面のテクスチャ**: ノイズ/グレインが乗っている（紙やプラスチックカードのような質感）
- **ベベル/エッジ**: カードの縁に微妙な立体感（内側に向かって凹んでいるような処理）
- **深い影**: カード全体に落ちる柔らかく深い影が浮遊感と同時に重量感を演出
- **角丸**: 物理的なカードを模した丸み

### 技術的な実現方法（推測）

```css
/* グラデーション + ノイズテクスチャ */
background: linear-gradient(to bottom, #5fa8d4, #3b82c4);
/* SVG noise filter または画像オーバーレイ */

/* ベベル/内側の影 */
box-shadow:
  inset 0 2px 4px rgba(255,255,255,0.3),   /* 上部ハイライト */
  inset 0 -2px 4px rgba(0,0,0,0.2),        /* 下部シャドウ */
  0 20px 40px rgba(0,0,0,0.3);             /* ドロップシャドウ */

/* 角丸 */
border-radius: 24px;
```

---

## Reference 2: kbkbkb.co

**URL**: https://kbkbkb.co/
**参照**: [reference-kbkbkb.md](./reference-kbkbkb.md)

### 質感の観察

- **展示物としての写真**: 写真が単なる画像ではなく、額装された作品のような佇まい
- **ダークな背景 (#0a0a0a)**: 美術館の壁のような、作品を引き立てる黒
- **静かな存在感**: 派手さを抑えた、長く見ていられる落ち着き
- **微妙な傾き**: 写真カードの傾きが、手作業で飾られた感覚を演出

### 「古い絵画に埃がかかったような質感」の解釈

これは視覚的なフィルターではなく、**態度・佇まい** かもしれない：

1. **急がない**: ローディングやトランジションが静か
2. **主張しない**: 装飾を極限まで削った結果の存在感
3. **時間を含む**: プロジェクトに年（2023, 2024）が付いていて、アーカイブとしての性格
4. **発見させる**: 説明を最小限にして、見る人が「見つける」余地を残す

---

## 適用の方向性

### A. カードコンポーネント

Works/Projects セクションで「展示物」としてのカードを作る

- ノイズテクスチャをオーバーレイ
- 深い影と微妙なベベル
- ホバーで「持ち上がる」動き

### B. ロゴ / Hero

ロゴやヒーローエリアに「質量感」を持たせる

- 立体的なシャドウ
- グラデーション + ノイズ
- 物理的なステッカー/バッジのような存在感

### C. 全体のトーン

サイト全体の「態度」として取り入れる

- 情報を詰め込まない（余白 over 密度）
- トランジションを静かに（息づき over 装飾）
- 時間軸を明示する（いつの作品かを見せる）

---

## 関連する表現・美学

- **Skeuomorphism（スキューモーフィズム）**: 物理的な質感の模倣
- **Neomorphism（ニューモーフィズム）**: 柔らかい立体感
- **Brutalism（ブルータリズム）**: 生々しい素材感
- **Wabi-sabi（侘び寂び）**: 不完全さ、経年変化の美
- **Museum aesthetic**: 展示物としてのデジタル

---

## 今後の検討

- [x] ノイズテクスチャの CSS/SVG 実装方法を調査 → `feTurbulence` フィルター使用
- [x] カードコンポーネントのプロトタイプ作成 → `texture-prototype.html`
- [ ] ロゴへの適用可能性を検討
- [ ] PRINCIPLES.md との整合性を確認
- [ ] 最終的なパターン選定と実装

---

## 選定候補パターン（2026-02-03）

プロトタイプ探索の結果、以下のパターンが候補として選定された。

### 採用方針

**セクション背景にテクスチャ、コンテンツはカードレス（ボーダーなし）**

### Light Mode 候補

| パターン | 説明 | 用途 |
|---------|------|------|
| **I1** | Light noise + Vignette（周辺減光） | フォーカスが必要なセクション |
| **J1** | Light noise + Cardless horizontal | Works リスト（画像付き） |
| **J3** | Light noise + List style minimal | Works リスト（テキスト中心） |

### Warm Mode 候補（アーカイブ感）

| パターン | 説明 | 用途 |
|---------|------|------|
| **J2** | Warm noise + Cardless vertical | 作品詳細、大きな画像 |
| **J4** | Warm noise + Text only | 余白重視、ステートメント |

### Dark Mode 候補（要ブラッシュアップ）

| パターン | 説明 | 状態 |
|---------|------|------|
| **J5** | Dark noise + Cardless list | テクスチャ感が弱い |
| **J5-v2** | 28% soft-light, brighter base | 改善版候補 |
| **J5-v3** | 15% screen, gradient | 改善版候補 |

### 技術的なポイント

```css
/* Light/Warm: multiply blend で紙の質感 */
mix-blend-mode: multiply;
opacity: 0.12-0.15;

/* Dark: overlay/soft-light/screen で見えやすく */
mix-blend-mode: soft-light; /* or screen */
opacity: 0.22-0.28;

/* Vignette: 周辺減光で中央にフォーカス */
background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.15) 100%);
```

### kbkbkb.co との共通点

- カードレス（ボーダー・区切りなし）
- 背景にテクスチャ
- 余白重視
- 情報密度低い

---

## プロトタイプファイル

- **HTML**: [assets/texture-prototype.html](./assets/texture-prototype.html)
- **参照画像**: [assets/texture-ref-nani-translate.png](./assets/texture-ref-nani-translate.png)

---

## Version History

| Date | Changes |
|------|---------|
| 2026-02-03 | 初版作成 - Nani Translate Card + kbkbkb.co からの着想 |
| 2026-02-03 | プロトタイプ作成、候補パターン選定（I1, J1-J4, J5改善版）|
