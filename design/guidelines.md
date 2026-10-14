# Guidelines

> この文書は、デザインを構成する 5 つの層ごとに役割と決まりを書く。決まりは項目に合った形式で、この文書かリンク先に置く。なぜそう決めたかは書かない。「未定」の項目は決まりを持たない。

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

見た目と振る舞いの土台の層。決まりと値は [design/foundations.pen](./foundations.pen) が持つ。

---

## Patterns

よくある場面での振る舞いの層。

### Feedback

- 合図は、かすかに、しかしはっきり分かる動きで示す
- 一部が取れなかったときは、取れた部分を出し、欠けたことを示す
- Shape（状態を伝える）: 未定
- AI を使っている場所を知らせる: 見せ方は未定。知らせるかどうかはこの文書の外で決める
- 出典: PRINCIPLES の息づき over 装飾、ADR-0032 の失敗の表し方、ADR-0037

### Loading

- HIG の Launching（起動してすぐ使い始められること）は、Web では最初の表示までの時間に当たり、ここで扱う
- 表示速度は ADR-0017 の値で測る
- 満たすべき値を割るときは、表示速度を見た目・動き・機能より優先する。目標値を割るだけなら優先しない
- 読み込みの後に要素の位置をずらさない
- 進み具合の見せ方: 未定
- 出典: ADR-0017

### Managing accounts

- 訪問者にアカウントを作らせない
- ログインは作り手だけが行い、判定はアプリケーションの外（Cloudflare Access）で行う。ログイン画面の見た目は作らない
- 出典: ADR-0013

### HIG に従う項目

ここに決まりを書いていない項目は、HIG の同じ名前のページに従う。Web に当てはまらない部分は除く。括弧の中は、HIG の各ページの冒頭の 1 文による。

- Charting data（図でデータを伝えること）
- Collaboration and sharing（内容に関わりながら、他の人とやり取りできる体験）
- Drag and drop（選んだ内容をつまんで移す、複製すること）
- Entering data（求める情報を、易しく間違いなく入力してもらう作り）
- File management（文書とファイルを作る・開く・保存すること）
- Going full screen（画面いっぱいに広げ、システムの操作を隠す状態）
- Managing notifications（端末が使用中でも施錠中でも、必要な知らせを届けること）
- Modality（親の画面を操作できなくし、明示の操作で閉じる見せ方）
- Offering help（必要なときだけ、その場の助けを出すこと）
- Onboarding（使い始めを素早くすること）
- Playing audio（状況が変わると自動で調整される音の体験）
- Playing haptics（触覚に働きかけ、現実世界での慣れを持ち込むこと）
- Playing video（動画を見る体験）
- Printing（システムの印刷機能を組み込むこと）
- Searching（端末の中、アプリの中、文書の中から内容を見つける手立て）
- Settings（自分に合うように設定を変えられること）
- Undo and redo（操作を戻す・やり直す手立て）

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

### HIG に従う項目

ここに決まりを書いていない部品は、HIG の同じ名前のページに従う。Web に当てはまらない部分は除く。

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

### HIG に従う項目

ここに決まりを書いていない項目は、HIG の同じ名前のページに従う。Web に当てはまらない部分は除く。括弧の中は、HIG の各ページの冒頭の 1 文による。

- Apple Pencil and Scribble（Apple Pencil での描画・手書き・書き込みと、指し示す道具としての扱い）
- Eyes（visionOS で、見た対象を操作の相手として選ぶこと）
- Gestures（アプリやゲームの中の対象に直接働きかける体の動き）
- Gyroscope and accelerometer（端末の物理的な動きのデータ）
- Pointing devices（トラックパッドやマウスでインターフェースを辿り、操作を始めること）

### 扱わない項目

括弧の中は、HIG の各ページの冒頭の 1 文による。

- Action button / Camera Control / Digital Crown / Remotes（iPhone・Apple Watch・Apple Vision Pro・Apple TV の物理ボタンとリモコンでの操作）: 公式が示す手段はアプリ向けの API だけで、Web のページで受け取る手段は示されていないため扱わない（2026-10-06 に確認）
- Game controls（ゲームの操作）: ゲームを持たないため扱わない
- Nearby interactions（近くの人や物の存在を使う体験）: 近くの人や物の存在を使う機能を持たないため扱わない

---

## References

synsk.me の記録

- PRINCIPLES: [docs/PRINCIPLES.md](../docs/PRINCIPLES.md)
- ADR-0013: [認証をアプリケーションの外で行う](../docs/decisions/0013-access-authentication.md)
- ADR-0017: [表示速度の指標と閾値](../docs/decisions/0017-display-speed-thresholds.md)
- ADR-0026: [コードの構成に ADOP を使う](../docs/decisions/0026-code-structure-adop.md)
- ADR-0032: [デザインパターンの基本を 9 つ置き、中身が合うものだけ一般名で呼ぶ](../docs/decisions/0032-basic-design-patterns.md)
- ADR-0037: [デザインガイドラインの層を Apple の Human Interface Guidelines に倣い、5 つ持つ](../docs/decisions/0037-design-guideline-layers-by-hig.md)

公開されているガイドライン

- HIG: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- Atlassian Tokens: [Design tokens](https://atlassian.design/foundations/tokens/design-tokens)
- WCAG 2.2: [SC 2.1.1](https://www.w3.org/TR/WCAG22/#keyboard)、[SC 2.4.7](https://www.w3.org/TR/WCAG22/#focus-visible)
