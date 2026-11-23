---
status: accepted
date: 2026-11-23
decision-makers: synsk
consulted: Claude
---

# 見出しの大きさと太さを、段でなく役割で決める

## Context and Problem Statement

ADR-0005 は Type Scale で `heading-1` を「ページタイトル」、`heading-2` を「セクション見出し」に当て、「見出しはサイズ差で区別し、ウェイト差には頼らない」とした。

PR #380 は、管理画面の見出しの大きさを、見出しの段（h1 / h2）から決めるようにした。h1 には `heading-1`、h2 には `heading-2` を当て、太さの指定は外した。その結果、2026-11-23 に次の状態を画面で確かめた。

- 一覧のツールバーの題（「職歴」など）が、画面でいちばん大きい文字になり、横の件数と操作と釣り合わない。同じ部品が、h1 の画面と h2 の画面で違う大きさになる
- 職務経歴書の中身の画面では、題（「2026.11」）とツールバーの題（「写した実績」）の 2 つの大きな見出しが上下に並ぶ。ツールバーの題は、すぐ上で選ばれたタブと同じ名前である
- 選んだタブが黒の地で塗られ、上段でいちばん濃い面になる

ツールバーの題とタブはナビの層に置く札で、ADR-0005 の Type Scale のどの用途にも当たらない。

## Decision Drivers

* 主役の一覧が先に読めること。HIG Toolbars は、ツールバーの題を「ほかのコントロール用に十分なスペースを確保するため」短くするよう求める
* 同じ部品は、どの画面でも同じ見た目であること
* 強い強調を、主な操作に取っておくこと。HIG Color（訳）「主な操作を強調するには、記号や文字でなく背景に色を付ける」

## Considered Options

* 見出しの段（h1 / h2）から大きさを決める（PR #380 の形）
* 役割（ページの題・ナビの札）から大きさと太さを決める

## Decision Outcome

Chosen option: "役割（ページの題・ナビの札）から大きさと太さを決める"。synsk が 2026-11-23 に手元の画面を見て選んだ。

**見出しの段は文書の構造で決め、見た目は役割で決める。**

| 役割 | 見た目 |
|---|---|
| ページの題 | `heading-1` |
| 上に Tab view を持つ画面の題 | `heading-2` の太字 |
| 節の見出し | `heading-2` |
| ツールバーの題 | 一覧の行の文字と同じ大きさの太字。h1 でも h2 でも同じ |

- タブで同じ名前が見えている区画では、ツールバーの題を画面に出さず、読み上げにだけ残す（HIG Toolbars「ツールバーのタイトルが冗長に感じられる場合は、タイトル領域を空のままにできます」）
- 選んだ項目（サイドバー・タブ）は、文字色の 8% の薄い地で示す。濃い地は主な操作に取っておく

ADR-0005 の Type Scale の「ページタイトル」の用途と、「見出しはサイズ差で区別し、ウェイト差には頼らない」は、この記録で改める。太さで区別してよいのは、上の表で太字とした役割に限る。ADR-0005 のそのほかの決定は改めない。

### Consequences

* Good, because ツールバーが横の操作と同じ行に収まり、一覧が先に目に入る
* Good, because 同じツールバーが、どの画面でも同じ見た目になる
* Bad, because 職務経歴書の中身では、開いていないタブの件数が、タブを開くまで分からない

### Confirmation

判定手段がない。見出しの見た目が役割に合っているかを機械的に確かめる方法は思いつかなかった。画面を撮って、上の表と照らし合わせる。

## More Information

- [HIG: Toolbars（日本語）](https://developer.apple.com/jp/design/human-interface-guidelines/toolbars)
- [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [PR #380](https://github.com/ksyunnnn/synsk.me/pull/380)
- [PR #383](https://github.com/ksyunnnn/synsk.me/pull/383)

関連する決定の記録

- [ADR-0005: Design Tokens](./0005-design-tokens.md)
