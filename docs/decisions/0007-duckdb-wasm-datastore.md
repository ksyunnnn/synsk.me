---
status: superseded by ADR-0014
date: 2026-08-20
decision-makers: synsk
---

# データストアに DuckDB WASM を採用する

## Context and Problem Statement

[ADR-0002](./0002-hub-and-spoke-data-architecture.md) は「Hub-and-Spoke モデルの採用」と「データストアに DuckDB を使用」という2つの決定を1本に含んでいた。これは [docs/adr/README.md](./README.md) が定める ADR の単位に反しており、Hub-and-Spoke だけを確定させることができない状態だった。本 ADR は後者を切り出して独立させる。

ADR-0002 の記録から、判断に必要な事実は以下のとおり。

- Hub-and-Spoke（外部プラットフォームから synsk.me へ集約する構造）は ROADMAP.md、ADR-0003、ADR-0006、research 配下の複数ドキュメントで前提として使われている
- DuckDB は 2026-01-31 の決定以降、package.json に導入されておらず、ROADMAP.md にも GitHub Issues にもタスクが存在しない
- ADR-0002 は「ビルド時生成 or WASM」と方式を両論併記のまま残していた

また ADR-0002 では検討されていなかった論点が2つある。

### 1. 公開データの露出

[content-model-design.md](../archive/content-model-design.md) は、訪問者に見せないデータを設計している。

「UI に表示しない」という設計は「配信されない」ことを意味しない。DuckDB を WASM で動かす場合、データファイルはブラウザへダウンロードされて実行されるため、UI に出していないフィールドも閲覧可能になる。

### 2. 初期ロードのコスト

DuckDB WASM の配布バイナリのサイズを 2026-08-20 に jsDelivr で実測した（@duckdb/duckdb-wasm v1.29.0）。

| ファイル | サイズ（非圧縮） |
|---------|----------------|
| `duckdb-mvp.wasm` | 38.7 MB |
| `duckdb-eh.wasm` | 34.0 MB |
| `duckdb-coi.wasm` | 33.6 MB |

圧縮転送されても数 MB 規模になり、これに JS グルーコードとデータファイルの取得が加わる。synsk.me が扱うコンテンツは数百件規模であり、タイムラインを表示するだけであればビルド時に JSON へ落とす方が初期表示は速い。

DuckDB の公式ドキュメントは WASM 版の用途を「in-browser SQL analytics」と位置づけており、シングルスレッド動作とメモリ上限 4GB という制約も明記している。初期表示の高速化ではなく、読み込み後にサーバー往復なしで分析クエリを返すことが利点である。

## Decision Drivers

* [実験 over 完璧な計画](../PRINCIPLES.md#2-実験)
* [おもしろさ over 安全圏](../PRINCIPLES.md#3-おもしろさ)

## Considered Options

* 静的生成のみ（DuckDB を使わない）
* 外部のマネージド DB（Supabase 等）
* DuckDB をビルド時のみ使用
* DuckDB WASM

## Decision Outcome

**データストアに DuckDB を採用し、ブラウザ上で動作する WASM 版を使用する。**

初期ロードのコストを承知のうえで採用する。synsk.me を技術実験場として使い、WASM でブラウザ内 SQL を動かす実地経験を得ることを目的に含む。

### Consequences

* Good, because ブラウザ内 SQL の実地経験を得られる。検証結果は発信コンテンツとして利用できる
* Good, because 読み込み完了後は、タグ・年代・プラットフォームなどによる絞り込みをサーバー往復なしで返せる
* Good, because サーバーやマネージド DB を持たずに済む
* Bad, because 初期ロードで圧縮後も数 MB 規模のダウンロードが発生する。タイムラインの表示のみを目的とする場合、Option A（静的生成）に対して初期表示は明確に遅くなる
* Bad, because シングルスレッド動作、メモリ上限 4GB という制約を受ける
* Bad, because **配信データの露出**: ブラウザへ配信するデータファイルに非公開フィールドが含まれると、UI に表示していなくても閲覧できてしまう
* Bad, because WASM 版がプロダクション用途で安定して動作するかは未検証（ADR-0002 から引き継ぐ）

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: 静的生成のみ（DuckDB を使わない）

ビルド時にコンテンツを JSON または HTML へ落とす。

- **Pros**: 初期表示が最速。数百件なら数十 KB に収まる。非公開フィールドはビルド時に除外でき、露出リスクがない
- **Cons**: 対話的な絞り込みを実装する場合はクライアント側に別途仕組みが要る。学習要素がない

### Option B: 外部のマネージド DB（Supabase 等）

- **Pros**: 運用が容易
- **Cons**: 外部サービスへの依存が生じる。ADR-0002 が Hub-and-Spoke の前提として避けた選択肢

### Option C: DuckDB をビルド時のみ使用

DuckDB でビルド時に集計し、結果を静的ファイルとして配信する。

- **Pros**: DuckDB の分析機能を使いつつ、配信物は軽量。非公開フィールドをビルド時に除外できる
- **Cons**: ブラウザ上での対話的クエリはできない

### Option D: DuckDB WASM — 採用

- **Pros**: 読み込み後はサーバー往復なしで分析クエリを実行できる。WASM の実地検証という学習価値がある。外部サービスに依存しない
- **Cons**: 初期ロードが重い。配信データの露出に配慮が必要

## References

- [DuckDB-Wasm 公式ドキュメント](https://duckdb.org/docs/stable/clients/wasm/overview.html)
- [@duckdb/duckdb-wasm — npm](https://www.npmjs.com/package/@duckdb/duckdb-wasm)
- [ADR-0002: Hub-and-Spoke データアーキテクチャ](./0002-hub-and-spoke-data-architecture.md)
- [ADR-0003: コンテンツデータモデル設計](./0003-content-data-model.md)
- [content-model-design.md](../archive/content-model-design.md)
