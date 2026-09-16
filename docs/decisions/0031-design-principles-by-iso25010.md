---
status: accepted
date: 2026-09-15
decision-makers: synsk
consulted: Claude
---

# 設計原則を ISO/IEC 25010 の品質特性ごとに 1 つ置く

## Context and Problem Statement

設計原則は、コードの判断の軸である。SWEBOK Guide V4.0a（2025-09-25）の 3 章は `Design principles provide direction or guidance for making decisions during design.` と定義する。UI の原則は `docs/PRINCIPLES.md` の Design Principles が持ち、設計原則はコードに絞る。

2026-09-15 に、設計原則の書き方として次を決めた。

- 7 つ以下にし、優先度の高い順に並べる。ぶつかったら上にある方を取る
- 次のすべてに当てはまるものだけを原則にする
  1. 逆を選ぶ人がいる（いなければ当たり前の文）
  2. 消すと AI が判断を誤る
  3. ツールで検査できない（できるならコード規約）
  4. 技術名を消しても成り立つ（成り立たなければ、デザインパターン・コード規約・ADR）
  5. 2 つ以上の別の場面で判断に使える（1 つなら個別の決定）

1〜3 は出典の記述による。4 と 5 は、出典（SWEBOK、Kindel、Morris、Anthropic の right altitude）から組み立てた基準で、出典にこの形では書かれていない。

同じ 2026-09-15 に、この書き方で次の 3 つの原則を作った。

1. 漏れない over 手軽さ
2. 部分的に成り立つ over 全部か無か
3. 単純さ over 先回りの構造

3 つは、それまでの個別の判断（DTO、Repository、失敗の扱い）から、共通する考えを拾い上げて作った。そのため、それまでの判断に出てこなかった観点（性能など）が抜けていた。

原則の数と衝突の扱いは、出典で食い違う（2026-09-15 に調べた。※は取得ツールの要約を経由したもの）。

- 数: Phil Le-Brun は `no more than 7 tenets, in descending order of priority` とする ※。AWS の General design principles は 6、Azure Architecture Center は 11 ※
- 衝突の扱い: Le-Brun は優先順位で決める。TOGAF の Consistent は、一方を厳守すると他方を緩く解釈する均衡として扱う。AWS と Azure は順位を付けていない

## Considered Options

* それまでの個別の判断から、共通する考えを拾い上げる
* ISO/IEC 25010:2023 の製品品質の特性ごとに 1 つ置く

## Decision Outcome

**ISO/IEC 25010:2023（Second edition、2023-11）の製品品質の 9 つの特性ごとに、設計原則を 1 つ置く。コードに当てはまらない特性には置かない。**

9 つの特性を 1 つずつ見て、9 つとも採った。2026-09-15 に作った 3 つの原則は、この 9 つで置き換える。書き方の「7 つ以下にし」は、「ISO/IEC 25010 の品質特性ごとに 1 つ置く。コードに当てはまらない特性には置かない」に改める。優先度の高い順に並べ、ぶつかったら上にある方を取ることは改めない。

### 並べ方

取り消せない害を先に、次に訪問者が受けるもの、最後に作り手が受けるものの順に並べる。TigerBeetle の `safety, performance, and developer experience. In that order.` と同じ向きである。

原則 9 を最後に置くのは、原則 7 と 8 が境目を先に作ることを求めるため。

### 設計原則

上にある原則ほど優先する。

| 順 | 原則 | 品質特性 | 理由 |
|---|---|---|---|
| 1 | 守る over 手軽さ | Security | 一度出た値や、書き換えられたデータは取り消せないため |
| 2 | 止まる over 危ない方へ進む | Safety | 誤って発信した内容や、膨らんだ費用は取り消せないため |
| 3 | 少なく正しく over 多く不確か | Functional suitability | 確かめていない機能は、壊れていても気づけないため |
| 4 | 部分的に成り立つ over 全部か無か | Reliability | 外部のサービスや一部のデータが欠けても、サイト全体が見られなくならないようにするため |
| 5 | 誰でも使える作り over 見た目だけの再現 | Interaction capability | 見た目だけ合わせた部品は、使えない人がいることに気づかないまま残るため |
| 6 | 測って直す over 先回りで速くする | Performance efficiency | 推測でした最適化は、効果が分からないまま、読みにくさだけを残すため |
| 7 | 外の形は境目で止める over 内側まで通す | Compatibility | 外部のサービスの仕様は、synsk.me の都合と関係なく変わるため |
| 8 | 置き場を選ばない over 1 つの環境に最適化 | Flexibility | 配信先やデータの置き場は、これまでにも替わってきたため（ADR-0007 は ADR-0014 に置き換えられた） |
| 9 | 単純さ over 先回りの構造 | Maintainability | 必要になる前に作った構造は、使われないまま、読むことと変えることの手間を増やすため |

### ぶつかったとき

| 順 | 1 つ上とぶつかったとき |
|---|---|
| 2 | 止めることで値が漏れるなら、漏らさない方を取る |
| 3 | 正しさのために、発信や費用の上限は外さない |
| 4 | 欠けた部分を、正しくない値で埋めて出さない |
| 5 | 表示を続けるために、使えない部品で代用しない |
| 6 | 閾値を割っても、使えない人を生む速くし方はしない |
| 7 | 閾値を割っていれば、境目の詰め替えの方法は変えてよい |
| 8 | 外のサービスとの境目は、置き場の都合より優先する |
| 9 | 境目（外のサービス、置き場）は、単純さより先に作る |

### Consequences

* Good, because 個別の判断に出てこなかった観点（性能など）も、品質特性の一覧から原則を持つ
* Bad, because 原則 2 で、ISO の Safety が扱う「財産」に作り手の費用を含めたのは、作り手と Claude の解釈である

### Confirmation

設計原則に沿っているかを `plan.md` で判定する形は、ADR-0034 が扱う。9 つの原則が品質特性と 1 対 1 に対応していることを判定する手段は定めていない。

## Pros and Cons of the Options

### それまでの個別の判断から、共通する考えを拾い上げる

* Bad, because 個別の判断に出てこなかった観点（性能など）が抜ける

### ISO/IEC 25010:2023 の製品品質の特性ごとに 1 つ置く — 採用

* Good, because 何を守りたいかの一覧から原則を作れる
* Bad, because 書き方の「7 つ以下」を改める必要がある

## More Information

出典の確かさ

- ISO/IEC 25010:2023 は、公式プレビュー PDF（表紙・目次・Foreword・3.4.4 まで）で確かめた: https://cdn.standards.iteh.ai/samples/78176/13ff8ea97048443f99318920757df124/ISO-IEC-25010-2023.pdf
- Reliability・Security・Maintainability・Flexibility の副特性と、Safety の中身の説明は要約経由（Sonar、arc42）

書き方の出典

- SWEBOK Guide V4.0a 3 章（2025-09-25）
- Phil Le-Brun「Tenets: supercharging decision-making」（AWS、2023-06-01）※要約
- [TigerBeetle: TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md)（最終コミット 2026-07-16）

関連する決定の記録

- [ADR-0034: 設計原則とデザインパターンを SOFTWARE_DESIGN.md に置き、constitution に写す](./0034-software-design-document.md)
