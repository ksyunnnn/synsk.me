---
paths:
  - "design/**"
---

# デザインファイルの作り方

`design/*.pen` を作る・直すときの決まり。用語は CLAUDE.md の「デザイン作業 > 用語」に従う。

## 名前

- すべての要素の名前の頭に、pen.dev の種類を付ける。`Frame: ` `Text: ` `Rectangle: ` `Component: ` `instance: `

## 構造

- Frame は、見える面（地か枠線がある）を作るときと、Component の中で要素を並べるときだけ使う。意味のまとまりを囲うだけの Frame を作らない
- 2 回以上使う形は Component にし、instance で置く。instance を Detach しない
- canvas の最上位には、Frame と Component だけを置く。Text を直接置かない

## 枠組みの見た目

- 枠組み（Header・見出し・カード・見本の場所）はライトの 1 系統にする。暗い地は、見本として入れるデザインにだけ使う
- 文字の大きさ・色・余白は、すでに使っている値から選ぶ。余白は 8 の倍数にする

## design/foundations.pen

- 正本は `design/foundations.pen` で、`design/guidelines.md` の Foundations の章はこのファイルを指す
- 列は Tokens / Styles / Guidelines の 3 つ。各列の頭に見出しを置き、その下にカードを縦に積む
- 列の間とカードどうしの間は 160px、見出しとカードの間は 40px
- Component は、一式の上の段に置く
- 決まりの文はカードの中で、見本の下に置く。未定のものは Component: Undecided で置く
