---
status: accepted
date: 2026-10-07
decision-makers: synsk
consulted: Claude
---

# デザインガイドラインの決まりを、値と方針ごと 1 つの Markdown に置く

## Context and Problem Statement

ADR-0037 の Context は、デザインガイドラインを「デザインを構成する層ごとに、その役割と置き場を書く文書である。各層の中身は書かず、各層の置き場が持つ」と定義した。各層の中身の置き場は決めていなかった。

2026-09-24 の時点で、`design/foundations.pen` は Colors / Typography / Spacing の 3 節と、色の変数 10 個（明暗それぞれ 5 つ）を持っていた。説明文は ADR-0005 と同じ内容だった。

置き場を決めるために、2026-09-28 に次を確かめた。

- pen.dev は、`.lib.pen` のライブラリを別の .pen から読み込み、変数とコンポーネントを共有できる。読み込み側からライブラリの中身は変えられない
- .pen は平文の JSON である。`design/foundations.pen` の git の全 5 版も平文だった
- pen.dev の変数を実装へ渡す公式の手段は、AI が変数を読んで CSS の `:root` に写すことだけである。トークン形式での書き出しはない
- 公開されているデザインシステム（GOV.UK・Primer・Atlassian・Stacks）は、文章の方針を Markdown か MDX でリポジトリに置く。どれも Web サイトのソースで、ビルドのときに実物の部品と一緒に表示する

## Considered Options

* 層ごとに .pen を 1 つ置く
* 文章の方針は Markdown に、値と見た目は .pen に分けて置く
* 1 つの Markdown に、値と方針を置く

## Decision Outcome

Chosen option: "1 つの Markdown に、値と方針を置く"。synsk が挙げた理由は次の 2 つである。

1. Markdown と .pen の行き来は面倒で、管理のコストが高い
2. HTML を組むほどのコストは払わない。設計と開発のときの指針として、最小限あればよい

### 置き場

**`design/guidelines.md` の 1 ファイルに、各項目の決まり（値と方針）を置く。Getting started の Design principles は `docs/PRINCIPLES.md` が持つ。**

ADR-0037 の Context の定義（各層の中身は書かず、各層の置き場が持つ）は、この記録で改める。ADR-0037 が決めた層と項目は改めない。

### 各項目の扱い

**各項目は、次のどれかを持つ。**

| 扱い | 意味 |
|---|---|
| 決まり | synsk.me としての決まりと、その出典を書く |
| HIG に従う | 決まりを書いていない項目は、HIG の同じ名前のページに従う。Web に当てはまらない部分は除く |
| 扱わない | 何を扱う項目かと、synsk.me で扱わない理由を書く |
| 未定 | HIG に同じ名前のページがなく、決まりもない |

HIG に従うとしたのは、synsk が HIG を根拠にしてよいとしたため（2026-10-06）。

決まりの中にある、synsk.me としての選択が要る小項目（アクセントカラー、Dark Mode の切り替え方など）は、未定のまま残してよい。ただし、サイト全体に効く小項目は、画面ごとに決めず、最初の画面の設計より前にまとめて決める。画面ごとに決めると、最初に作った画面の都合で全体の値が決まるため（2026-10-06）。

### Consequences

* Bad, because 色の値を、`design/foundations.pen` の変数と `design/guidelines.md` の 2 か所が持つ

### Confirmation

`design/guidelines.md` の各項目が、決まり・HIG に従う・扱わない・未定のどれかに入っているかを、目で見て確かめる。機械的に判定する手段は思いつかなかった。

## More Information

- [pen.dev: Design libraries](https://docs.pen.dev/core-concepts/design-libraries)
- [pen.dev: .pen files](https://docs.pen.dev/core-concepts/pen-files)
- [pen.dev: Design ↔ Code](https://docs.pen.dev/design-and-code/design-to-code)
- [GOV.UK Design System](https://github.com/alphagov/govuk-design-system)
- [Primer: design](https://github.com/primer/design)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

関連する決定の記録

- [ADR-0037: デザインガイドラインの層を Apple の Human Interface Guidelines に倣い、5 つ持つ](./0037-design-guideline-layers-by-hig.md)
- [ADR-0005: Design Tokens](./0005-design-tokens.md)
