---
status: proposed
date: 2026-09-08
decision-makers: synsk
consulted: Claude
---

# 公開経路が読むものをデータベースのビューに限る

## Context and Problem Statement

[ADR-0008](./0008-content-visibility.md) は、公開できる値と公開できない値を同一レコードの別カラムとして対にして持つと決め、その帰結として「選別の漏れ」を Bad に記録した。除外リスト方式ではカラムが増えたときに漏れ、許可リスト方式であれば新しいカラムは既定で公開されない、というものである。

[ADR-0014](./0014-authoring-and-datastore.md) は、採用した選択肢の理由として「公開できない値を、出力する場所の 1 箇所で選別できる」を挙げた。**その 1 箇所をどこに置くかは決めていない。** 2026-09-08 時点で、選別を行うコードはリポジトリに存在しない。

wrangler 4.128.0 を使い、リポジトリの外に隔離した Worker 設定で次を実測した。

```sql
CREATE VIEW career_public AS
  SELECT id, client_public FROM career WHERE visibility = 'public';
```

このビューを作ったあとに `ALTER TABLE career ADD COLUMN secret_note TEXT` を実行して値を入れ、ビュー越しに `SELECT *` を実行した。出力は `id` と `client_public` の 2 列だけで、`secret_note` は現れなかった。

同じ環境で、値域が `CHECK` 制約で表現できること、D1 が制約違反を `SQLITE_CONSTRAINT_CHECK` で拒むこと、`wrangler d1 export --no-data` の出力にビューと `CHECK` がそのまま現れることを確認した。

## Decision Drivers

* [対話 over 展示](../PRINCIPLES.md#3-対話)
* 2026-09-08 に示された判断の優先順位。読めること、後から覆せること、漏れないことの順とする

## Considered Options

* 出力を作る場所で、公開してよいカラムを列挙する
* 公開用の型を型の宣言から導出する
* 公開経路が読むものをデータベースのビューに限る
* 公開できない値を別のストアに隔離する

## Decision Outcome

**公開経路が読むものをデータベースのビューに限る。ビューはスキーマの正本と同じ記述の中に置く。**

- 可視性の段階ごとにビューを持つ
- ビューが選ぶカラムの列挙が、公開してよい値の定義そのものになる
- 公開経路はテーブルを直接読まない

ビューの名前と、可視性の段階ごとの粒度は本 ADR では扱わない。

### Consequences

* Good, because **後から足したカラムがビュー越しの出力に現れない。** 許可リストであることが、実装の作法ではなくデータベースの構造によって保たれる
* Good, because 公開してよい値の定義が、カラム・型・値域と同じ 1 枚に並ぶ。[ADR-0022](./0022-schema-source-of-truth.md) が正本を手書きの SQL に置くため、境界も同じ形式で読める
* Good, because 公開できない値がデータベースから出てこない。ADR-0008 が別ストアへの隔離で得ようとした性質を、同一レコードのまま得る
* Bad, because **ビューは既定値であって防御ではない。** 公開経路がテーブルを直接読めば素通りする。この不変条件を保つ仕組みが別に要る
* Bad, because SQLite のビューは読み取り専用である。書き込みの経路は全カラムを触る。認証をアプリケーションの外で行う決定（[ADR-0013](./0013-access-authentication.md)）により、書き込みの経路は Cloudflare Access の内側に限られる
* Bad, because 可視性の段階を増やすとビューが増える。段階とビューの対応を人が保つ
* Neutral, because 型の側で公開できない値を表現し直す必要はない。ビューが返す列がそのまま公開してよい値になる

### Confirmation

2 つを検査する。どちらも 2026-09-08 時点で存在しない。

1. 未知のカラムを 1 本足したフィクスチャを与え、ビュー越しの出力にそれが現れないことを確かめる。ADR-0019 が定める「コミット前」の層に置く
2. 公開経路がテーブル名を直接書いていないことを確かめる。ビューの名前だけが現れることを検査する。この検査はビューの名前がテーブルの名前を部分文字列として含まない命名を要する。`career` と `career_public` の組では、素朴な文字列の一致が必ず誤って検出する

ビューが未知のカラムを返さないことは、2026-09-08 に隔離した環境で実測済みである。1 はその性質の回帰検査にあたる。

## Pros and Cons of the Options

### 出力を作る場所で、公開してよいカラムを列挙する

出力を組み立てる関数が、返す値を明示的に選ぶ。

* Good, because データベースに手を入れずに始められる
* Bad, because 出力を作る場所が増えるたびに列挙が増える。1 箇所である保証がない
* Bad, because 列挙を書き忘れた経路は、既定で全カラムを返す

### 公開用の型を型の宣言から導出する

公開してよいカラムを型で宣言し、そこから公開用の型を導く。

* Good, because 型検査が公開してはいけない値の受け渡しを止める
* Bad, because 型は実行時に消える。データベースから取り出した行そのものは全カラムを持つ
* Bad, because スキーマの正本とは別の記述が 1 系統増える。ADR-0022 が正本を SQL に置くため、値域の定義が 2 か所に分かれる

### 公開経路が読むものをデータベースのビューに限る — 採用

* Good, because 未知のカラムが構造的に出力へ現れない
* Good, because 記述が正本と同じ 1 枚に収まる
* Bad, because テーブルを直接読む経路を塞ぐのは、ビューの外側の仕組みになる

### 公開できない値を別のストアに隔離する

* Good, because 公開側に公開できない値が存在しない
* Bad, because ADR-0008 が既に棄却している。1 件の情報が 2 つのストアに分かれ、対応関係を手で維持することになる

## More Information

- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0013: 認証をアプリケーションの外で行う](./0013-access-authentication.md)
- [ADR-0014: internal コンテンツを管理画面から書き、Cloudflare D1 に保管する](./0014-authoring-and-datastore.md)
- [ADR-0019: テストを 4 段階に分け、段階ごとに時間の上限を定める](./0019-testing-strategy.md)
- [ADR-0022: スキーマの正本を手書きの SQL 1 枚に置く](./0022-schema-source-of-truth.md)
- [CREATE VIEW · SQLite](https://www.sqlite.org/lang_createview.html)
- [STRICT Tables · SQLite](https://www.sqlite.org/stricttables.html)
