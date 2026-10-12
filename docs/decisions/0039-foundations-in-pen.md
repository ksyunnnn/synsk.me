---
status: accepted
date: 2026-10-12
decision-makers: synsk
consulted: Claude
---

# Foundations の決まりと値を design/foundations.pen に置く

## Context and Problem Statement

ADR-0038 は、デザインガイドラインの決まりを値と方針ごと `design/guidelines.md` に置くと決めた。Foundations の決まりは見た目の決まりで、文章だけでは読み手が思い浮かべられない。

## Considered Options

* `design/guidelines.md` に文章で置く（ADR-0038 のまま）
* `design/foundations.pen` に図で置く

## Decision Outcome

Chosen option: "`design/foundations.pen` に図で置く"。synsk が挙げた理由は、文章だと自分でも分からなくなるため。

**Foundations の決まりと値は `design/foundations.pen` が持つ。`design/guidelines.md` の Foundations の章は、このファイルを指す。** ほかの層は ADR-0038 のまま `design/guidelines.md` が持つ。

### Consequences

* Bad, because 決まりを直すたびに、Pen のアプリで開き、pencil MCP で書き、`pen interactive` の `save()` で保存する手間がかかる

### Confirmation

`design/guidelines.md` の Foundations の章に、決まりが書かれていないことを目で見て確かめる。機械的に判定する手段は思いつかなかった。

## More Information

- [ADR-0038: デザインガイドラインの決まりを、値と方針ごと 1 つの Markdown に置く](./0038-design-guideline-single-file.md)
