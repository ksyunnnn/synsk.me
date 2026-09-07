---
status: proposed
date: 2026-09-08
decision-makers: synsk
consulted: Claude
---

# スキーマの正本を手書きの SQL 1 枚に置く

## Context and Problem Statement

[ADR-0014](./0014-authoring-and-datastore.md) は internal コンテンツを Cloudflare D1 に保管すると決めたが、D1 へどう読み書きするかを決めていない。2026-09-08 時点で `migrations/` は存在せず、`package.json` に ORM の依存は 0 件、`src/` に `env.DB` を使うコードは 0 件である。

2026-09-08 に、判断の優先順位が示された。読めること、後から覆せること、漏れないことの順である。「読めること」は、半年後にファイル 1 枚を開いて、テーブルとカラムに加えて**どんな値が入るか**まで読めることを指す。

wrangler 4.128.0 を使い、リポジトリの外に隔離した Worker 設定で次を実測した。

- `wrangler d1 migrations apply` の 2 回目は `✅ No migrations to apply!` を返す。適用記録は `d1_migrations` テーブルが持つ
- 手で書いた SQL ファイルを `wrangler d1 execute --file` で流す形は、**既存のテーブルにカラムを足しても実体が変わらないまま成功を報告する**。`CREATE TABLE IF NOT EXISTS` に 1 カラム足して再適用したところ、`🚣 1 command executed successfully.` を返しながら `sqlite_master` の定義は変わらなかった
- `wrangler d1 export --no-data` は実体の DDL を再現する。`STRICT`・`UNIQUE`・`CHECK` は保持され、`CREATE TABLE IF NOT EXISTS` は `CREATE TABLE` に正規化される
- マイグレーションを適用したデータベースの export には `PRAGMA defer_foreign_keys=TRUE;`・`CREATE TABLE IF NOT EXISTS "d1_migrations"(...)`・`DELETE FROM sqlite_sequence;` が混じり、並びは適用順になる
- `ALTER TABLE` で足したカラムは export の出力で `, secret_note TEXT)` の形で末尾に付く

外部の一次資料から次を得た。

- SQLite の `ALTER TABLE` が直接できるのは 5 操作のみである（テーブルの改名、カラムの改名、カラムの追加、カラムの削除、`NOT NULL` の設定と解除）。型の変更や `UNIQUE` の追加は 12 手順のテーブル再構築に落ちる
- Drizzle のスキーマ定義はダイアレクト間で移植できない。公式が「there is no such thing as a common table object in drizzle」と述べる
- Drizzle の差分を生成する道具は、SQLite のテーブル再構築で cascade delete を考慮せず関連データを黙って失う問題を抱えている（drizzle-team/drizzle-orm の issue 4938、2025-09-25 起票、2026-09-08 時点で open）

## Decision Drivers

* [実験 over 完璧な計画](../PRINCIPLES.md#2-実験)
* 2026-09-08 に示された判断の優先順位。読めること、後から覆せること、漏れないことの順とする

## Considered Options

* マイグレーションの列だけを正本にする
* 宣言的な正本を手で書き、流し直して適用する
* 宣言的な正本を手で書き、マイグレーションも人が書く
* マイグレーションを正本とし、読むための 1 枚を導出する
* 宣言的な正本を持ち、差分の生成を道具にやらせる

## Decision Outcome

**スキーマの正本を手書きの SQL 1 枚に置き、マイグレーションも手で書く。両者が一致することを機械で突き合わせる。**

- 正本は `STRICT` テーブルで書き、値域を `CHECK` 制約で表す
- マイグレーションの生成は `wrangler d1 migrations create` が行い、中身は人が書く
- `wrangler.jsonc` の `d1_databases` に `migrations_dir` と `migrations_pattern` を書かない。既定の `migrations/*.sql` に従う
- 正本を `schemas/schema.sql` に置く。`migrations/` の直下に置かない。既定のパターン `migrations/*.sql` に一致し、`wrangler d1 migrations apply` がマイグレーションとして適用するためである（2026-09-08 に実測。`migrations/schema.sql` を置いた状態で apply したところ、適用対象として拾われ `✅` を返した）
- 差分を生成する道具を入れない

突き合わせを実装する場所は本 ADR では扱わない。

### Consequences

* Good, because 半年後に開く 1 枚に、カラム・型・値域が同じ形で並ぶ。`STRICT` により型は 6 種に限られ、`CHECK` の有無が列挙と自由文字列を分ける
* Good, because 本番に流れる文そのものがレビューの対象になる。テーブル再構築が必要な変更でも、何が起きるかが読める形で残る
* Good, because 版の結び目が増えない。2026-09-08 時点で `vinext` が `1.0.0-beta.9` であり、テストの構成がそれに引きずられて固定されている
* Bad, because **正本とマイグレーションを人が二重に書く。** 突き合わせの検査が無ければ、片方だけ更新される
* Bad, because 突き合わせの前に、export の出力から `d1_migrations` の DDL・`PRAGMA`・`DELETE FROM sqlite_sequence` を除き、並びを揃える処理を自分で書くことになる
* Bad, because テーブル再構築の 12 手順を人が書く。D1 は暗黙のトランザクションの中で動くため、手順 1 の `PRAGMA foreign_keys=OFF` を使えず `PRAGMA defer_foreign_keys` に読み替える
* Neutral, because データベースを移る費用は下がらない。Drizzle のスキーマ定義もダイアレクト間で移植できないため、道具を入れても同じである

### Confirmation

マイグレーションを適用したデータベースと、正本から作ったデータベースの `wrangler d1 export --no-data` の出力を突き合わせ、差分があれば落とす。突き合わせの前に `d1_migrations` の DDL・`PRAGMA defer_foreign_keys`・`DELETE FROM sqlite_sequence` を除き、テーブル名で並べ替える。

正本から作る側は、毎回空のデータベースを用意し、正本を 1 回だけ流す。既存のデータベースへ流し直す形は本 ADR が棄却しているが、空のデータベースへの初回の適用は働くため、検査は成立する。

この検査は 2026-09-08 時点で存在しない。

## Pros and Cons of the Options

### マイグレーションの列だけを正本にする

`migrations/` の SQL ファイルの列がスキーマを定義する唯一の記述になる。

* Good, because 記述が 1 系統しかなく、二重に書く場所がない
* Bad, because 実体のスキーマを知るには、全ファイルを順に読むか `sqlite_master` を引くことになる。1 枚で読めない

### 宣言的な正本を手で書き、流し直して適用する

`schemas/schema.sql` を書き、`wrangler d1 execute --file` で適用する。Cloudflare 公式のチュートリアルが初回作成の手順として示す形である。

* Good, because 記述が 1 枚に収まる
* Bad, because **2 回目以降が働かない。** 実測では、正本にカラムを足して再適用しても実体は変わらず、成功が報告された。乖離が起きたことを検査でも気づけない

### 宣言的な正本を手で書き、マイグレーションも人が書く — 採用

* Good, because 1 枚で読める形と、レビューできる差分の両方を得る
* Good, because 道具を増やさない
* Bad, because 2 系統を人が同期する。ADR-0011 の Context が記録した失敗（文書が実態から離れても、離れたことに気づけない）と同じ形になりうる
* Neutral, because 同期の失敗は機械で検出できる。`wrangler d1 export --no-data` の突き合わせがそれにあたる

### マイグレーションを正本とし、読むための 1 枚を導出する

`wrangler d1 export --no-data` の出力をコミットする。

* Good, because 人が二重に書かない。乖離が原理的に起きない
* Bad, because 出力は人が書いたファイルではない。`ALTER TABLE` の痕跡が末尾に付き、雑音が混じり、並びは適用順になる。読むための 1 枚として整えるには、除去と整列を自作して保守することになる

### 宣言的な正本を持ち、差分の生成を道具にやらせる

型で書いた宣言から差分の SQL を生成する。

* Good, because 正本が 1 つで、差分が自動で出る
* Good, because カラム名の変更が型検査で全箇所に波及する
* Bad, because 生成物にテーブル再構築が混じる。SQLite の `ALTER TABLE` が 5 操作しか許さないためである
* Bad, because **差分を生成する道具が cascade delete を考慮せず関連データを黙って失う問題が報告されている。** [ADR-0003](./0003-content-data-model.md) は Career から Project、Project から Activity への 3 段の参照を決めており、cascade が効く形である
* Bad, because 版の結び目が 1 つ増える

## More Information

- [ADR-0003: コンテンツデータモデル設計（C: 分離モデル）](./0003-content-data-model.md)
- [ADR-0011: 記録の住み分けを定める](./0011-record-separation.md)
- [ADR-0014: internal コンテンツを管理画面から書き、Cloudflare D1 に保管する](./0014-authoring-and-datastore.md)
- [ADR-0019: テストを 4 段階に分け、段階ごとに時間の上限を定める](./0019-testing-strategy.md)
- [Migrations · Cloudflare D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Import and export data · Cloudflare D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [ALTER TABLE · SQLite](https://www.sqlite.org/lang_altertable.html)
- [STRICT Tables · SQLite](https://www.sqlite.org/stricttables.html)
- [Schema declaration · Drizzle](https://orm.drizzle.team/docs/sql-schema-declaration)
- [drizzle-team/drizzle-orm issue 4938](https://github.com/drizzle-team/drizzle-orm/issues/4938)
