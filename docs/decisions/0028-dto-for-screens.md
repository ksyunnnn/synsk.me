---
status: accepted
date: 2026-09-14
decision-makers: synsk
consulted: Claude
---

# 画面に渡すときは、出してよい値だけを詰めた形（DTO）を作る

## Context and Problem Statement

synsk.me のコードは、層の分け方と依存のルールを nrs（成瀬 允宣）の ADOP（Application Domain Others Pattern）に従う。2026-09-14 にそう判断した。ADOP の本文は、画面の側へ返すデータの形を定めていない。

画面に渡すデータの形を、2026-09-14 の対話で判断した。判断に使った事実は次のとおり。

- [ADR-0008](./0008-content-visibility.md) は、公開できる値とできない値を同じレコードに対で持つ（`client` / `clientPublic`）。Bad に、除外リスト方式だとカラムが増えたときに漏れ、許可リスト方式なら新しいカラムは既定で公開されない、とある
- Shared Data Model の記事では、画面に出さない値に 1 つずつ印を付けている: `Notice that I added [JsonIgnore] attributes to two of the properties, since I didn't want to serialize them to JSON.`（訳: JSON にしたくなかったので、2 つのプロパティに `[JsonIgnore]` を付けた）
- Martin: `We don’t want to cheat and pass Entities or Database rows.`（訳: ずるをしてエンティティやデータベースの行を渡したくはない。2012-08-13）
- Next.js の Data Access Layer: `Return safe, minimal Data Transfer Objects (DTOs).`（訳: 安全で最小限の DTO を返す。2026-08-25）
- ADOP は、保存のときにデータベース用の形へ移し替えることを勧めている: `UserStoryDataModel といったオブジェクトに移し替えを行い、ドメインレイヤーが特定のインフラストラクチャのコードに侵食されないようにすることを推奨します。`

## Considered Options

比べた選択肢は、Mark Seemann の [Three data architectures for the server](https://blog.ploeh.dk/2024/07/25/three-data-architectures-for-the-server/)（2024-07-25）から取った。Seemann 自身は `none of these articles are meant to be prescriptive` と書いている。

* Ports and Adapters
* Shared Data Model
* Domain Model only

## Decision Outcome

**画面に渡すときは、出してよい値だけを詰めた箱（DTO、Data Transfer Object）を作る。** Considered Options のうち Ports and Adapters を選ぶ。

### Consequences

* Good, because Seemann は Ports and Adapters の良い点に `Separation of concerns`、`Well-described` を挙げる
* Bad, because Seemann は Ports and Adapters の悪い点に `Much mapping`、`Easy to get wrong` を挙げる

### Confirmation

画面側のファイルが保存用の型を受け取らないことを、[ADR-0033](./0033-code-conventions-as-static-analysis.md) で足す静的解析の規則で検査する。2026-09-16 の時点の型検査と eslint の設定では、保存する形をそのまま画面へ渡すコードは error にならなかった。

## Pros and Cons of the Options

良い点と悪い点は Seemann の原文のまま引く。

### Ports and Adapters — 採用

画面用・ドメイン用・データベース用に別の形を持ち、境界で詰め替える。

* Good, because `Separation of concerns`、`Well-described`
* Bad, because `Much mapping`、`Easy to get wrong`

### Shared Data Model

1 つの形を、保存・ビジネスロジック・画面のすべてで使い回す。

* Good, because `Simple`、`No mapping`
* Bad, because `Inflexible`、`God Class attractor`

### Domain Model only

ドメインのオブジェクトを中心にし、DTO を持たない。

* Good, because `Flexible`、`Congruent with reality`
* Bad, because `Requires non-opinionated framework`、`Requires more testing`

## More Information

- Mark Seemann: [Three data architectures for the server](https://blog.ploeh.dk/2024/07/25/three-data-architectures-for-the-server/)（2024-07-25）
- nrs: [ADOP (Application Domain Others Pattern)](https://nrslib.com/adop/)（公開 2020-12-13、更新 2021-04-23）

関連する決定の記録

- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
