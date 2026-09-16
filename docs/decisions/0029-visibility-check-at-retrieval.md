---
status: accepted
date: 2026-09-14
decision-makers: synsk
consulted: Claude
---

# 公開してよい状態かは、データを取り出すとき（リポジトリの実装）に確かめる

## Context and Problem Statement

synsk.me のコードは、層の分け方と依存のルールを nrs（成瀬 允宣）の ADOP（Application Domain Others Pattern）に従う。2026-09-14 にそう判断した。`features/<名前>/` の中で、`domain/` はエンティティ・値オブジェクト・リポジトリのインタフェースを持ち、`application/` はユースケースを持ち、`server/` はリポジトリの D1 での実装を持つ。

「見せてよいか」の確認（認可、authorization）は 3 種類に分かれる。

1. 作り手本人か（認証、authentication）。Cloudflare Access がサイトの外で確かめる（[ADR-0013](./0013-access-authentication.md)）
2. 限定公開を見せてよい相手か。[ADR-0008](./0008-content-visibility.md) が対象外としている
3. そのデータは公開してよい状態か

この記録が決めるのは 3 だけである。2026-09-14 の対話で判断した。判断に使った事実は次のとおり。

- Next.js の認証ガイド: `The majority of security checks should be performed as close as possible to your data source`（訳: セキュリティの確認の大半は、データの出どころにできるだけ近い場所で行うべき。2026-08-25）
- ADOP は、リポジトリのインタフェースを Domain に置くことを既定にしている: `ファクトリやリポジトリのインターフェースなどのオブジェクトも、便宜上このレイヤーに配置します。`。同じ記事は `ただし、これはそれらをアプリケーションレイヤーに配置する可能性を奪うものではありません。` とも書く

## Considered Options

* データベースから取り出すときに確かめる
* 取り出したあと、ユースケース（`application/`）の中で確かめる
* 画面（`page.tsx`）を作るときに確かめる

## Decision Outcome

**公開してよい状態か（可視性、visibility）は、データベースから取り出すとき（リポジトリの実装）に確かめる。公開済みのものだけを取り出す。「公開済みとは何か」の決まり（ドメインのルール）と頼み方（リポジトリのインタフェース）は `domain/` に置く。**

### Consequences

* Good, because 取り出していないものは漏れない

### Confirmation

判定手段を定めていない。公開済みのものだけを取り出しているかは、静的解析で検査する項目（[ADR-0033](./0033-code-conventions-as-static-analysis.md)）に含まれない。

## Pros and Cons of the Options

### データベースから取り出すときに確かめる — 採用

* Good, because 取り出していないものは漏れない

### 取り出したあと、ユースケース（`application/`）の中で確かめる

* Bad, because 確かめ忘れた流れがあると漏れる

### 画面（`page.tsx`）を作るときに確かめる

* Bad, because 画面を足すたびに確かめる必要がある

## More Information

- nrs: [ADOP (Application Domain Others Pattern)](https://nrslib.com/adop/)（公開 2020-12-13、更新 2021-04-23）

関連する決定の記録

- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0013: 認証をアプリケーションの外で行う](./0013-access-authentication.md)
