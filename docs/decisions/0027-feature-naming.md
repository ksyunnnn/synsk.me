---
status: accepted
date: 2026-09-14
decision-makers: synsk
consulted: Claude
---

# `features/` はもの（データ）の名前で切る

## Context and Problem Statement

[ADR-0026](./0026-code-structure-adop.md) は、機能ごとのコードを `features/<名前>/` に置く。`<名前>` は `specs/` のディレクトリ名から仮に取っていた。

同じものの呼び名が、記録ごとに揃っていなかった。

| 出どころ | 日付 | 名前 |
|---|---|---|
| ADR-0003 | 2026-02-02 | Activity・Project・Career |
| ADR-0008 | 2026-08-21 | internal のコンテンツ |
| ADR-0016（URL） | 2026-08-27 | `/notes`・`/projects`・`/resume` |
| `specs/` | 2026-09-08 まで | notes-list-detail・resume-output・note-editor・timeline |

spec `004-timeline`（2026-09-08）は、timeline を `timeline は固有の経路を持たない表示単位とし` としている。

## Decision Drivers

* DDD Reference（© 2015）: `Give the modules names that become part of the ubiquitous language.`（訳: モジュールには、ユビキタス言語の一部になる名前を付ける）
* Jimmy Bogard: `a change fits in one context window, the blast radius stops at the slice boundary`（訳: 変更が 1 つのコンテキスト窓に収まり、影響の範囲がまとまりの境界で止まる。2026-09-01）

## Considered Options

* もの（データ）の名前で切る
* 画面・機能の名前で切る
* URL のコレクション名で切る

## Decision Outcome

**`features/` はもの（データ）の名前で切る。`activity/`・`note/`・`project/`・`career/`・`resume/` とする。**

- 「internal のコンテンツ」は `note` にそろえる。URL と `specs/` に合わせた選択で、出典からは決まらない
- timeline は `activity/` の中の部品にする

### Consequences

* Bad, because 「internal のコンテンツ」を `note` にそろえることは、出典から決まらない。URL と `specs/` に合わせた選択である

### Confirmation

判定手段を定めていない。`features/` の下の名前は、静的解析で検査する項目（[ADR-0033](./0033-code-conventions-as-static-analysis.md)）に含まれない。

## Pros and Cons of the Options

### もの（データ）の名前で切る — 採用

`activity/`・`note/`・`project/`・`career/`・`resume/`

### 画面・機能の名前で切る

`timeline/`・`note-editor/`・`notes/`・`resume/`

### URL のコレクション名で切る

`notes/`・`projects/`・`resume/`

* Bad, because activity は URL を持たないので置き場がない

## More Information

- [Evans: Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)（© 2015）

関連する決定の記録

- [ADR-0003: コンテンツデータモデル設計（C: 分離モデル）](./0003-content-data-model.md)
- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0016: URL の規則](./0016-url-conventions.md)
- [ADR-0026: コードの構成に ADOP を使う](./0026-code-structure-adop.md)
