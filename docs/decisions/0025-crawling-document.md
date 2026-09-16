---
status: accepted
date: 2026-09-13
decision-makers: synsk
consulted: Claude
---

# 機械の読み手へのルールを CRAWLING.md に置く

## Context and Problem Statement

[ADR-0024](./0024-machine-readers.md) は、機械の読み手にどう振る舞うかを決めた。その中には、公開しているページを `sitemap.xml` に載せる、Bot Fight Mode を有効にしない、のように、ページや機能を足すたびに守り続けるものが含まれる。

2026-09-13 の時点で、`docs/README.md` の入れ物の表に、これを受け取れる入れ物はなかった。

- `decisions/` は「これから守るべきルール」を書いてはいけないものとする
- `REQUIREMENTS.md` は「実装方法」を書いてはいけないものとし、語るのは機能をまたいで満たすべきことである
- `specs/<機能>/plan.md` は「機能をまたぐ決定」を書いてはいけないものとする

[ADR-0020](./0020-requirement-placement.md) は、文書の書式の規定を決定の記録にしない理由を「書き換えれば覆せるため」としている。守り続けるルールも、書き換えて改めることを前提にしている点で同じ性質を持つ。

## Considered Options

* `decisions/` の決定の記録に書く
* `REQUIREMENTS.md` に書く
* `.claude/rules/` に書く
* `docs/CRAWLING.md` を新設する

## Decision Outcome

**機械の読み手にどう応えるかのルールを、新設する `docs/CRAWLING.md` に置く。**

- 語ることは「機械の読み手にどう応えるか」、時制は現在形とする
- 書いてはいけないものは、理由、実装方法、未決事項、Issue 番号とする。理由は決定の記録が持つ
- 参照は `CRAWLING.md` から `decisions/` への一方向とし、`spec.md` から `CRAWLING.md` を参照してよい。`decisions/` から `CRAWLING.md` へは張らない

### Consequences

* Good, because 機械の読み手へのルールを1つの文書で読める
* Good, because 決定の記録が決定だけを持ち続け、守り続けるルールが混ざらない
* Bad, because 入れ物が1つ増え、書く前に振り分ける判断が増える
* Bad, because `CRAWLING.md` と `REQUIREMENTS.md` を振り分ける基準がない。どちらも機能をまたぎ、どちらも実装方法を禁じる
* Bad, because `check.sh` の `[参照の向き]` は並び順に `CRAWLING.md` を含まず、逆向きのリンクを検出しない

### Confirmation

`grep -nE '\]\([^)]*CRAWLING\.md' docs/decisions/*.md` が何も返さないことで、決定の記録から `CRAWLING.md` へのリンクがないことを判定する。`CRAWLING.md` に理由や実装方法が混じっていないことを判定する手段はない。「実装方法」の定義がないため。

## Pros and Cons of the Options

### `decisions/` の決定の記録に書く

* Good, because 理由とルールを1つの文書で読める
* Bad, because 決定の記録は承認後に書き換えないため、ルールを改めるたびに記録を置き換えることになる
* Bad, because `docs/README.md` が禁じる「これから守るべきルール」に当たる

### `REQUIREMENTS.md` に書く

* Good, because 機能をまたぐ文書が既にあり、入れ物を増やさない
* Bad, because 書式が「〜できる」の見出しと根拠の2行に限られ、どう応えるかのルールを書けない
* Bad, because `Bot Fight Mode を有効にしない` のように、手段を名指すルールが「実装方法」に当たりうる

### `.claude/rules/` に書く

* Good, because 書き換えて覆せる規定の置き場として、ADR-0020 が既に使っている
* Bad, because ADR-0020 が置き場とするのは文書の書式の規定であり、サイトの振る舞いのルールではない
* Bad, because Claude が作業するときに読み込む規則であり、サイトの方針を読みに来た人の入口にならない

### `docs/CRAWLING.md` を新設する — 採用

* Good, because 役割と時制を、このルールに合わせて定められる
* Bad, because 入れ物が増え、`docs/README.md` の表と参照の向きを更新する必要がある

## More Information

- [docs/README.md](../README.md) の「入れ物と役割」と「参照の向き」
