---
status: proposed
date: 2026-09-17
decision-makers: synsk
consulted: Claude Code
---

# D1 へは ORM を使わずに読み書きし、スキーマの正本を手で書く SQL のマイグレーションにする

## Context and Problem Statement

note・timeline・career と project は、どれも D1 にデータを持つ。どう読み書きし、スキーマの正本をどこに持つかは、この3つすべてに効く。

2026-09-17 に、次を確かめた。

- D1 は SQL の `BEGIN` を受け付けない。ローカルの D1 で `prepare('BEGIN').run()` を実行すると `D1_ERROR: To execute a transaction, please use the state.storage.transaction() or state.storage.transactionSync() APIs instead of the SQL BEGIN TRANSACTION or SAVEPOINT statements` で拒まれた。複数の文を原子的に行う手段は `db.batch()` である
- Drizzle ORM の D1 向け `transaction()` は、`drizzle-orm/d1/session.js` の中で `begin` を発行する。kysely-d1 0.4.0 の `beginTransaction` は `Transactions are not supported yet.` を投げる
- `@cloudflare/vitest-plugin` の `readD1Migrations` は、指定したディレクトリの直下にある `.sql` だけを読む。Drizzle が生成するマイグレーションは `<timestamp>_name/migration.sql` の入れ子になる
- 同じ処理（SELECT 1本と、UPDATE 2本の batch）を esbuild で minify した大きさは、素の D1 が 315 B、Drizzle 1.0.0-rc.4 が 78,007 B、Kysely 0.29.6 と kysely-d1 0.4.0 が 158,729 B だった。Workers の上限（圧縮前 64 MiB）にはどれも収まる
- Drizzle の公式が案内する版は 1.0.0-rc.4 で、npm の latest は 0.45.2 だった。列を変えて SQLite の表を作り直すとき cascade の削除を考慮しない不具合（drizzle-team/drizzle-orm#4938）は OPEN だった
- STRICT の表でも、TEXT の列に数値 123 を bind すると拒まれず `"123.0"` として入った

## Decision Drivers

* 単純さ over 先回りの構造（`docs/SOFTWARE_DESIGN.md` の設計原則9）
* 置き場を選ばない over 1つの環境に最適化（同 設計原則8）
* 少なく正しく over 多く不確か（同 設計原則3）

## Considered Options

* ORM を使わず、D1 の prepared statement を Repository の実装の中で使う
* Drizzle ORM
* Kysely と kysely-d1

## Decision Outcome

Chosen option: "ORM を使わず、D1 の prepared statement を Repository の実装の中で使う", because どの案でも複数の文をまとめるには `db.batch()` を使うことになり、ORM を入れても書き方が変わらず、依存と既存のテスト基盤との食い違いだけが増えるため。

- D1 の API（`env.DB.prepare()`、`bind()`、`batch()`）は、機能の `server/` にある Repository の実装の中でだけ使う
- スキーマの正本は、リポジトリ直下の `migrations/` に置く、手で書いた SQL の並びとする。別の `schema.sql` を持たない
- マイグレーションは `npx wrangler d1 migrations create synsk-me <name>` で作り、中身を手で書く
- `wrangler.jsonc` に `migrations_dir` と `migrations_pattern` を書かず、既定の `migrations/` を使う
- 本番への適用は `npx wrangler d1 migrations apply synsk-me --remote` による
- 公開してよいかを確かめる場所は ADR-0029 による。この記録は変えない

### Consequences

* Good, because workerd のテストが、本番と同じ `migrations/` をそのまま `readD1Migrations` で読める
* Good, because D1 から別の置き場へ移るとき、書き直す範囲が Repository の実装とマイグレーションに限られる
* Bad, because 取り出した行の型は、TypeScript の型を当てはめるだけで、実物を検証しない。STRICT の表も型の食い違いを拒みきらない。本物のマイグレーションを当てた workerd のテストで補う
* Bad, because スキーマ全体を1枚で読める文書がない。`npx wrangler d1 export synsk-me --local --no-data --output=<path>` で導出する
* Bad, because SQLite の ALTER TABLE で直接できる操作は限られ、型の変更や UNIQUE の追加は表の作り直しを手で書くことになる

### Confirmation

- `vitest.workers.config.ts` が `migrations/` を読み、Repository の実装のテストが通ること
- `package.json` の依存に ORM とクエリビルダがないこと。判定は PR のレビューによる。静的な検査は置いていない

## Pros and Cons of the Options

### ORM を使わず、D1 の prepared statement を Repository の実装の中で使う

* Good, because 足す依存がない
* Good, because 既存のテスト基盤（`readD1Migrations` と `applyD1Migrations`）の形のまま使える
* Bad, because 行の型を実物で確かめない

### Drizzle ORM

* Good, because スキーマの定義から TypeScript の型を導ける
* Bad, because D1 向けの `transaction()` が D1 で使えない
* Bad, because 生成するマイグレーションの入れ子の形を、`readD1Migrations` が読めない
* Bad, because 公式の案内する版と npm の latest が食い違う

### Kysely と kysely-d1

* Good, because クエリの組み立てに型が付く
* Bad, because D1 の dialect は第三者製で、最終コミットは 2025-04-19
* Bad, because トランザクションを実装していない。マイグレーションは手書きになる

## More Information

- [Cloudflare D1: Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1: D1 Database（batch）](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare D1: Type conversion](https://developers.cloudflare.com/d1/worker-api/#type-conversion)
- [Drizzle ORM: Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [drizzle-team/drizzle-orm#4938](https://github.com/drizzle-team/drizzle-orm/issues/4938)
- [ADR-0029: 公開してよい状態かは、データを取り出すとき（リポジトリの実装）に確かめる](./0029-visibility-check-at-retrieval.md)
