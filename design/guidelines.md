# Guidelines

> この文書は、デザインを構成する 5 つの層ごとに役割を書き、各項目の決まり（値と方針）をこの 1 ファイルに置く。なぜそう決めたかは書かない。「未定」の項目は決まりを持たない。

## Contents

- How to Use This Document
- Getting started
- Foundations
- Patterns
- Components
- Inputs
- References

---

## How to Use This Document

- 各項目は、決まりと出典を持つ。決まりは「〜する」「〜しない」の形で書く。出典の略記は References にある
- 値はトークンの名前で使い、色や寸法を直に書かない（Atlassian Tokens）
- 「扱わない」項目は、synsk.me に当たる画面や入力がない
- 「未定」の項目で判断が要るときは、Getting started の原則に照らす。決まったら、決まりと出典をここに書く（PRINCIPLES の How to Use This Document）

---

## Getting started

原則の層。判断に迷ったときに立ち返る。

### Design principles

- [docs/PRINCIPLES.md](../docs/PRINCIPLES.md) の Design Principles に照らす。余白 over 密度 / 緩急 over 息づき / 息づき over 装飾 / 対話 over 展示 / たどり着きたい情報 over 演出
- 原則が衝突したら、上位の原則を優先する
- 出典: PRINCIPLES

---

## Foundations

見た目と振る舞いの土台の層。値はここが持つ。

### Accessibility

- 文字と地のコントラスト比を 4.5:1 以上にする。大きな文字は 3:1 以上
- UI 部品を見分けるのに要る境界と図形は、隣の色と 3:1 以上にする。`border` は `background` と 3:1 に届かないため、UI 部品を見分ける手がかりを `border` だけにしない
- スクリーンリーダー（VoiceOver）: 未定
- 出典: WCAG 2.2 SC 1.4.3・SC 1.4.11、ADR-0005 の値

### Branding

- 訪れた人に感じてほしいのは、有機的な息づきを感じる空間にいるときの感覚。ワクワクして何か始めたくなり、それでいて落ち着いている
- 派手さで気を引かない。説得しようとしない
- キービジュアルと UI の両方に同じ決まりを使う
- Key visual / Logos / Illustrations / Shape（ブランドを表す）: 未定
- 出典: VISION の Internal FAQ、PRINCIPLES の Anti-Principles、ADR-0035

### Color

- 無彩色のグレー（`hsl(0, 0%, x%)`）だけで構造を作る。色で印象を左右しない
- `muted` の上に `muted-foreground` を置かない。ライトで 4.5:1 を満たさない
- アクセントカラー: 未定

| Token | Light | Dark | 使う場所 |
|---|---|---|---|
| `background` | hsl(0, 0%, 100%) | hsl(0, 0%, 3.9%) | ページの地 |
| `foreground` | hsl(0, 0%, 3.9%) | hsl(0, 0%, 98%) | 本文 |
| `muted` | hsl(0, 0%, 96.1%) | hsl(0, 0%, 14.9%) | 控えめな地 |
| `muted-foreground` | hsl(0, 0%, 45.1%) | hsl(0, 0%, 63.9%) | 補足の文字 |
| `border` | hsl(0, 0%, 89.8%) | hsl(0, 0%, 14.9%) | 境界線 |

- 出典: ADR-0005、WCAG 2.2 SC 1.4.3

### Dark Mode

- ライトとダークの両方を持つ。値は Color の表の Dark の列
- 切り替え方（端末の設定に従うか、切り替えを置くか）: 未定
- 出典: ADR-0005

### Design tokens

- 色・文字・余白・ブレークポイントは、この文書のトークンの名前で使う。値の正本はこの文書
- トークンは見た目が合うかでなく、名前と使う場所が合うかで選ぶ
- Border: 境界線の色は `border`。太さは未定
- Radius / Shape（角の丸みの段階の値）: 未定
- 出典: Atlassian Tokens、ADR-0005

### Icons

- UI のアイコンは Phosphor Icons を使う
- 外部プラットフォームを示すアイコンは Simple Icons を使う。Simple Icons にないものは Phosphor Icons の `Planet` を使う
- Phosphor Icons のウェイト: 未定。Typography と合わせて決める
- 出典: ADR-0004

### Images

- リンクが貼られたときのカード画像は、note ごとに「題を入れた自動生成」「note に追加した画像」「サイト共通のアイキャッチ」から選ぶ。既定は題を入れた自動生成
- 解像度と画像形式: 未定
- 出典: ADR-0024

### Layout

- 情報を詰め込まない。見る人が考える余地を残す
- 演出を通らずに、たどり着きたい情報へ行ける道を置く
- 内容を安全領域の内側に置く。`viewport-fit=cover` と `env(safe-area-inset-*)` で受け取る
- 画面の大きさが変わっても組み替えず、小さな調整で合わせる
  - 上の 2 つは、HIG のアプリ向けのページ（Designing for iPhone Duo）の観点を、Web に当てはめて使っている
- 折り目と開閉の状態は扱わない。Safari から取れない
- Shape（注意を向ける）: 未定

| Breakpoint | 値 | 想定する端末 |
|---|---|---|
| `sm` | 480px | スマートフォンの横向き |
| `md` | 768px | タブレット |
| `lg` | 976px | デスクトップ |
| `xl` | 1440px | 大きなデスクトップ |

- 出典: PRINCIPLES の余白 over 密度・たどり着きたい情報 over 演出、HIG Designing for iPhone Duo、WebKit: Designing Websites for iPhone X、ADR-0035、ADR-0005

#### Spacing

- 8px を基準にし、次の 5 段だけを使う

| Token | 値 | 使う場所 |
|---|---|---|
| `xs` | 8px | インライン要素の間、アイコンと文字の間 |
| `sm` | 16px | 部品の内側の余白 |
| `md` | 24px | カードの内側、フォームの要素の間 |
| `lg` | 48px | セクションの間、大きなまとまりの間 |
| `xl` | 96px | ページのセクションの間、ヒーロー領域 |

- 出典: ADR-0005

### Materials

- すりガラスの効果（背景をぼかし、明るさを整えて奥行きを作る）は、操作の層にだけ使う。内容の層に使わない
- 使う場所を、いちばん大事な操作に絞る
- 出典: HIG Materials

### Motion

- スクロールを止めたら、動きも静まる。動き続けない
- 息づきは残す。200〜500ms の微細な変化（scale 0.9→1.0 程度）で表す
- 派手な動きで気を引かない
- 動きを減らす設定（`prefers-reduced-motion: reduce`）では、自動で動くものと繰り返す動きを止める
- 出典: PRINCIPLES の緩急 over 息づき・息づき over 装飾・Anti-Principles、HIG Accessibility

### Privacy

- リンクが貼られたときのカードに出す情報を、そのページを開いた人が見られる範囲に収める。限定公開のページのカードには中身を出さない
- 権限の求め方: 未定
- 出典: ADR-0024

### Typography

- 英語は Source Sans 3、日本語は Noto Sans JP。どちらも Google Fonts
- 本文のウェイトは Light 300
- 見出しはサイズの差で区別し、ウェイトの差に頼らない

| Token | サイズ | 行の高さ | 使う場所 |
|---|---|---|---|
| `heading-1` | 32–36px | 1.3 | ページの題 |
| `heading-2` | 24–28px | 1.4 | セクションの見出し |
| `body` | 18px | 1.8 | 本文 |
| `small` | 14px | 1.6 | 補足の文字 |
| `caption` | 12px | 1.5 | キャプション、ラベル |

| 使う場所 | letter-spacing | text-transform |
|---|---|---|
| 本文 | normal | none |
| 見出し | -0.01em | none |
| ラベル、ナビゲーション | 0.08–0.1em | uppercase |

- 出典: ADR-0005

### Writing

- 作品を見せる語り口でなく、共に考える入り口として語る
- 完璧な専門家像を演じない。説得しようとしない
- 気を引くための誇張をしない
- 出典: PRINCIPLES の対話 over 展示・Anti-Principles、ADR-0024

### 未定の項目

App icons / Elevation / Inclusion

App icons は、favicon など Web で同じ役割を持つものに当てはめる（ADR-0035）。

---

## Patterns

よくある場面での振る舞いの層。

### Feedback

- 合図は、かすかに、しかしはっきり分かる動きで示す
- 一部が取れなかったときは、取れた部分を出し、欠けたことを示す
- Shape（状態を伝える）: 未定
- AI を使っている場所を知らせる: 見せ方は未定。知らせるかどうかはこの文書の外で決める
- 出典: PRINCIPLES の息づき over 装飾、ADR-0032 の失敗の表し方、ADR-0035

### Loading

- HIG の Launching（起動してすぐ使い始められること）は、Web では最初の表示までの時間に当たり、ここで扱う
- 表示速度は ADR-0017 の値で測る。LCP 2,500ms・INP 200ms・CLS 0.1・TTFB 800ms・FCP 1,800ms を満たすべき値、LCP 1,100ms・INP 75ms・CLS 0・TTFB 450ms・FCP 900ms を目標値とする。モバイルとデスクトップそれぞれの 75 パーセンタイルで判定する
- 満たすべき値を割るときは、表示速度を見た目・動き・機能より優先する。目標値を割るだけなら優先しない
- 読み込みの後に要素の位置をずらさない（CLS の目標値 0）
- 進み具合の見せ方: 未定
- 出典: ADR-0017

### Managing accounts

- 訪問者にアカウントを作らせない
- ログインは作り手だけが行い、判定はアプリケーションの外（Cloudflare Access）で行う。ログイン画面の見た目は作らない
- 出典: ADR-0013

### 未定の項目

Charting data / Collaboration and sharing / Drag and drop / Entering data / File management / Going full screen / Managing notifications / Modality / Offering help / Onboarding / Playing audio / Playing haptics / Playing video / Printing / Searching / Settings / Undo and redo

### 扱わない項目

括弧の中は、HIG の各ページの冒頭の 1 文による。

- Live-viewing apps（ライブ映像を見る体験）: ライブ映像を配信しないため扱わない
- Multitasking（複数のアプリを行き来して作業すること）: 行き来はブラウザと OS が担うため扱わない。画面の大きさの変化は Layout で扱う
- Ratings and reviews（App Store での評価の求め方）: App Store に出さないため扱わない
- Workouts（運動の記録）: 運動を記録する機能を持たないため扱わない

---

## Components

部品の層。

- 操作・フォーカス・状態は headless のライブラリに任せ、見た目と動きをかぶせる
- 出典: ADR-0032 の見た目と操作を分ける、ADR-0026

### 未定の項目

- Content: Charts / Image views / Text views / Web views
- Layout and organization: Boxes / Collections / Column views / Disclosure controls / Labels / Lists and tables / Lockups / Outline views / Split views / Tab views
- Menus and actions: Activity views / Buttons / Context menus / Dock menus / Edit menus / Home Screen quick actions / Menus / Ornaments / Pop-up buttons / Pull-down buttons / The menu bar / Toolbars
- Navigation and search: Path controls / Search fields / Sidebars / Tab bars / Token fields
- Presentation: Action sheets / Alerts / Page controls / Panels / Popovers / Scroll views / Sheets / Windows
- Selection and input: Color wells / Combo boxes / Digit entry views / Image wells / Pickers / Segmented controls / Sliders / Steppers / Text fields / Toggles / Virtual keyboards
- Status: Activity rings / Gauges / Progress indicators / Rating indicators

### 扱わない項目

- System experiences（App Shortcuts / Complications / Controls / Live Activities / Notifications / Snippets / Status bars / Top Shelf / Watch faces / Widgets）: OS が持つ場所に出す部品で、Web のページからは置けない

---

## Inputs

入力の層。

### Focus and selection

- キーボードで操作しているとき、フォーカスの位置を目で確かめられるようにする
- 出典: WCAG 2.2 SC 2.4.7

### Keyboards

- すべての操作をキーボードで行えるようにする
- 出典: WCAG 2.2 SC 2.1.1

### 未定の項目

Apple Pencil and Scribble / Eyes / Gestures / Gyroscope and accelerometer / Pointing devices

### 扱わない項目

括弧の中は、HIG の各ページの冒頭の 1 文による。

- Action button / Camera Control / Digital Crown / Remotes（iPhone・Apple Watch・Apple Vision Pro・Apple TV の物理ボタンとリモコンでの操作）: 公式が示す手段はアプリ向けの API だけで、Web のページで受け取る手段は示されていないため扱わない（2026-10-06 に確認）
- Game controls（ゲームの操作）: ゲームを持たないため扱わない
- Nearby interactions（近くの人や物の存在を使う体験）: 近くの人や物の存在を使う機能を持たないため扱わない

---

## References

synsk.me の記録

- PRINCIPLES: [docs/PRINCIPLES.md](../docs/PRINCIPLES.md)
- VISION: [docs/VISION.md](../docs/VISION.md)
- ADR-0004: [アイコンシステム](../docs/decisions/0004-icon-system.md)
- ADR-0005: [Design Tokens](../docs/decisions/0005-design-tokens.md)
- ADR-0013: [認証をアプリケーションの外で行う](../docs/decisions/0013-access-authentication.md)
- ADR-0017: [表示速度の指標と閾値](../docs/decisions/0017-display-speed-thresholds.md)
- ADR-0024: [機械の読み手を歓迎し、キャッシュで受ける](../docs/decisions/0024-machine-readers.md)
- ADR-0026: [コードの構成に ADOP を使う](../docs/decisions/0026-code-structure-adop.md)
- ADR-0032: [デザインパターンの基本を 9 つ置き、中身が合うものだけ一般名で呼ぶ](../docs/decisions/0032-basic-design-patterns.md)
- ADR-0035: [デザインガイドラインの層を Apple の Human Interface Guidelines に倣い、5 つ持つ](../docs/decisions/0035-design-guideline-layers-by-hig.md)

公開されているガイドライン

- HIG: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)（[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)、[Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo)、[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)）
- Atlassian Tokens: [Design tokens](https://atlassian.design/foundations/tokens/design-tokens)
- WCAG 2.2: [SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum)、[SC 1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast)、[SC 2.1.1](https://www.w3.org/TR/WCAG22/#keyboard)、[SC 2.4.7](https://www.w3.org/TR/WCAG22/#focus-visible)
- WebKit: [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
