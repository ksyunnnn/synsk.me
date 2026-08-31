---
status: accepted
date: 2026-08-27
decision-makers: synsk
---

# internal コンテンツを管理画面から書き、Cloudflare D1 に保管する

## Context and Problem Statement

記事の本文と画像と過去の版を synsk.me 自身が持つ、とは決まっていたが、それをどこに置くかは決めていなかった（[ADR-0010](./0010-content-storage-scope.md)）。外部プラットフォームへ転載する方針（[ADR-0006](./0006-posse-publishing-strategy.md)）も、記事を公開する仕組みができるまで動かせない状態だった。

2026-08-26 に、どこが重くて書かなくなるのかを聞き取った。挙がったのは、書きながら公開後の見た目を確かめられないこと、画像を貼るのに手間がかかること、保存を意識しなければならないこと、公開のたびにコミットと push とビルドの待ちが挟まること、公開後の小さな直しに同じ手数がかかること、外出先やスマートフォンから書けないこと。

公開できる値とできない値を同じレコードに並べて持ち、出すときに選ぶ、という形は決まっていた（[ADR-0008](./0008-content-visibility.md)）。この形は、出力する場所で出す項目を列挙する方法と噛み合う。OWASP、Django REST Framework、Laravel、Next.js のいずれも同じ方法を推している。ただしこの方法は、データベースへ届く経路が自分の書いたコードだけであることを前提とする。ブラウザから直接読み書きできる仕組みでは、その経路を通らない入口が別に開いており、データベース側にも規則を書くことになる。

データの置き場所は 2026-08-20 に一度決めていた（[ADR-0007](./0007-duckdb-wasm-datastore.md)）。ただしその翌日に、データを永続化すること、公開・限定公開・非公開を区別すること、過去の版を保管することが決まっている。前日の決定はそれらを前提に含んでいない。

## Decision Drivers

* [実験 over 完璧な計画](../PRINCIPLES.md#2-実験)

## Considered Options

* リポジトリに Markdown を置く
* 外部の CMS で書く
* ブラウザから直接読み書きできるデータベースを使う
* サーバを経由して Cloudflare D1 に読み書きする

## Decision Outcome

**internal コンテンツをブラウザ上の管理画面で作成・編集し、本文を Cloudflare D1 に保管する。公開操作の後に別の工程を挟まずに反映する。**

本 ADR は [ADR-0007](./0007-duckdb-wasm-datastore.md) を置き換える。

### Consequences

* Good, because 書く、確かめる、公開する、直すが同じ画面で完結する
* Good, because 公開できない値を、出力する場所の1箇所で選別できる
* Good, because 過去の版の持ち方を自分で決められる
* Bad, because 編集の仕組み、版の保存方式、読み書きの処理を自分で作ることになる
* Bad, because サーバ側で動く部分を持つため、静的配信だけでは成立しない
* Bad, because ブラウザ内で SQL を動かす経験は得られなくなる
* Bad, because **オフラインで書けない。** Option A では手元で完結していた

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: リポジトリに Markdown を置く

- **Pros**: 過去の版を git が持つ。データベースも認証も要らない
- **Cons**: 公開のたびにコミットと push とビルドを伴う。スマートフォンから書く手段が実質ない

### Option B: 外部の CMS で書く

- **Pros**: 編集の仕組みを作らずに済む
- **Cons**: 本文の正本が外部へ移り、[ADR-0006](./0006-posse-publishing-strategy.md) と矛盾する

### Option C: ブラウザから直接読み書きできるデータベースを使う

Supabase や Firebase を使う。

- **Pros**: サーバ側の処理を書かずに済む
- **Cons**: 出力する場所で選別する方法と噛み合わない。データベース側にも規則を書くことになる

### Option D: サーバを経由して Cloudflare D1 に読み書きする — 採用

- **Pros**: データベースへ届く経路が自分の書いたコードだけになる。選別を1箇所で行える
- **Cons**: 読み書きの処理を自分で書くことになる

## References

- [ADR-0006: 発信戦略として POSSE を採用する](./0006-posse-publishing-strategy.md)
- [ADR-0007: データストアに DuckDB WASM を採用する](./0007-duckdb-wasm-datastore.md)
- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0010: internal コンテンツの正本を synsk.me が持つ](./0010-content-storage-scope.md)
- [ADR-0012: ホスティングに Cloudflare を採用する](./0012-cloudflare-hosting.md)
- [OWASP: Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
- [Django REST Framework: Serializers](https://www.django-rest-framework.org/api-guide/serializers/)
- [Laravel: Eloquent API Resources](https://laravel.com/docs/12.x/eloquent-resources)
- [Next.js: How to implement authentication](https://nextjs.org/docs/app/guides/authentication)
