---
status: accepted
date: 2026-10-26
decision-makers: synsk
consulted: Claude Code
---

# D1 の列の名前を意味ごとに1つにし、列の性質を接尾辞と接頭辞で表す

## Context and Problem Statement

D1 のスキーマ（20 の表）の CHECK に入れる値を決めるときに、列の名前に次の揺れと競合が見つかった（2026-10-24）。

- `public` が表ごとに逆の意味だった。project の `visibility = 'public'` は実際の値で出し、resume の `audience = 'public'` は秘匿化した値で載せる
- 訪問者に見せるかを、`status`（note）と `visibility`（resume など）の2つの名前で表していた
- `activity.source_id` は `_id` で終わるが、外部キーではなく取得元での記事の ID だった
- 分類を `type`（project）と `kind`（activity_source）、代表の画像の URL を `thumbnail_url` と `image_url`、経験年数の上書きを `years_override` と `years` の、それぞれ2つの名前で呼んでいた
- 真偽の列に、`is_` で始まるもの（`is_highlighted`）と始まらないもの（`ok`）が混ざっていた

本番のデータを持たないスキーマでは、どの列の名前もマイグレーションの書き換えで変えられる。2026-10-24 の時点で、このスキーマは本番に出していない。列の名前をどう決めるかは、activity・note・project・career・resume のすべての表に効く。

## Decision Drivers

* 守る over 手軽さ（[SOFTWARE_DESIGN.md](../SOFTWARE_DESIGN.md#1-守る-over-手軽さ)）。`public` の意味を取り違えると、実名を出す条件を逆に書く
* 1つの意味に1つの名前を当てる。ユビキタス言語（https://martinfowler.com/bliki/UbiquitousLanguage.html ）と、文章ルールの S4

## Considered Options

* 列の名前の決まりを定め、すべての列を揃える
* 表ごとの名前を残し、意味の違いを注記で補う

## Decision Outcome

Chosen option: "列の名前の決まりを定め、すべての列を揃える", because 注記で補う形では、条件を書くたびに注記を読む必要があり、取り違えを防げないため。

列の名前は、1つの意味に1つの名前を当てる。外部キー・真偽・年月と日付・日時・秘匿化した値の区別は、接尾辞と接頭辞で表す。「公開」は訪問者に見せることだけを指し、訪問者に見せるかは `status` で表す。

これに合わせて、次の列の名前を変える。

| 変える前 | 変えた後 |
|---|---|
| project.visibility | project.is_masked |
| resume.visibility | resume.status |
| activity.source_id | activity.external_id |
| project.type | project.kind |
| fetch_result.ok | fetch_result.is_ok |
| activity.thumbnail_url | activity.image_url |
| resume_project_skill.name・resume_skill_override.name | skill_name |
| resume_skill_override.years | years_override |
| career.visibility | career.is_masked |

activity_source.origin（外部か内部か）は外す。activity は外部の取得元から取った項目と life event だけを持つ（ADR-0044）。区別する相手は life event だけなので、activity.source で足りる。

education.visibility は外す。education は職務経歴書を通してだけ出し、見せるかどうかは resume.status と resume.audience が決める。

### Consequences

* Good, because 列の名前から、外部キーか・真偽か・日時か・秘匿化した値かが読める
* Good, because `public` の取り違えで実名を出す誤りが、名前の段階で起きにくくなる
* Bad, because 決まりに合わない名前を、書くときに人が見つける必要がある。機械の検査は無い

### Confirmation

判定手段がない。名前が意味に合っているかは、機械で判定する方法が思いつかなかった。マイグレーションを書くときに、決まりと突き合わせる。

## Pros and Cons of the Options

### 列の名前の決まりを定め、すべての列を揃える

* Good, because 新しい表を足すときも、同じ決まりで名前を付けられる
* Bad, because 既に付けた名前を変える手間がかかる。本番のデータを持たないスキーマでは、手間はマイグレーションの書き換えに限られる

### 表ごとの名前を残し、意味の違いを注記で補う

* Good, because 名前を変える手間がない
* Bad, because 注記を読まずに条件を書くと、`public` を逆の意味で使う
