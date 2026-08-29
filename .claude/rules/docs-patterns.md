---
paths:
  - "docs/**/*.md"
---

# ドキュメントの書き方

役割と時制の定義は [docs/README.md](../../docs/README.md) にある。ここは書式の例だけを持つ。

## Contents

- 冒頭の宣言
- 要件
- 決定の記録
- Issue
- 検査の例外

---

## 冒頭の宣言

`REQUIREMENTS.md` と `scraps/` の各文書は、**見出しの直後**に引用ブロックで宣言を置く。他文書へのリンクを含めない（参照の向きに違反するため）。

```
REQUIREMENTS.md:  > この文書は満たすべきことだけを書く。進捗と実装方法は書かない。
scraps/:          > 書き捨て。消えても困らないものだけを置く。
```

`VISION.md` `PRINCIPLES.md` `template.md` `decisions/*.md` と各ディレクトリの `README.md` は宣言の対象外。ただし `scraps/README.md` は、その場所の性質を読む人に伝える必要があるため宣言を持つ。

## 要件

書式は見出し1行と根拠1行の2行だけ。ID は通し番号で、領域で分けない。決定日は書かない（根拠の記録が持つ）。

```
✓ ## FR-99: internal コンテンツの過去の版を保持し、任意の版に戻せる
  根拠: [ADR-9999](./decisions/9999-versioning.md)

✗ ## FR-99: 記事の版管理ができる
   → 何ができれば満たされるか読めない

✗ ## FR-99: 再取得に配慮する
   → 検証できない

✗ ## NFR-99: バックアップを適切に行う
   → 「適切」が判定できない
```

FR は機能要件、NFR は非機能要件（性能・可用性・セキュリティ・保守性・コスト）。

**この文書（REQUIREMENTS.md）の中でのみ**、対象を指す語を `activity` / `career` / `project` / `internal コンテンツ` の4つに固定する。「エントリ」「レコード」「記事」を使わない。決定の記録には及ばない。データベースの行を指す「レコード」のように、4語では言い換えられない概念があるため。

## 決定の記録

テンプレートは [docs/decisions/template.md](../../docs/decisions/template.md)（MADR 4）。対象と単位は [docs/decisions/README.md](../../docs/decisions/README.md) が定める。

**front matter** — `status` `date` `decision-makers` を使う。`consulted` と `informed` は書かない。`decision-makers` は `synsk`。

**使う節** — Context and Problem Statement / Decision Drivers / Considered Options / Decision Outcome / Consequences / Pros and Cons of the Options / References

**使わない節** — Confirmation / More Information。参照は `## References` に置く

**見出しに番号を書かない。** 番号はファイル名が持つ。他文書からは `ADR-NNNN` で参照する。

**Decision Drivers** — 判断を駆動したものを並べる。任意の節。該当する原則があれば、アンカー付きのリンクで1行目に置く。

```
✓ * 実験 over 完璧な計画（[PRINCIPLES.md](../PRINCIPLES.md#2-実験)）
✗ * [PRINCIPLES.md](../PRINCIPLES.md)
   → どの原則が効いたか読めない
```

```
✓ Decision Outcome: 外部プラットフォームへの転載は synsk.me を正本とする（POSSE）
✗ Decision Outcome: VISION.md と PRINCIPLES.md を定義する
   → 代替案がない。文書の存在告知でしかない

✓ Context and Problem Statement: Medium の RSS には rel="canonical" が含まれない（2026-08-20 に実フィードを取得して確認）
✗ Context and Problem Statement: （他文書の表をそのまま転記）
   → 転記の過程で未決が決定に格上げされる
```

**引用してよいのは決定の記録から決定の記録への引用に限る。** 決定の記録は書き換えないので引用が古くならない。書き換わる文書（`REQUIREMENTS.md`）からは引用せず、リンクか ID で参照する。

**Consequences に「決めていない」と書いてよいのは、その決定の帰結として生じた不確実性に限る。** その記録で決めるべきだったことは Issue が持つ。

```
✓ Bad, because 版の粒度を決めていない。保存のたびに版を作るのか、
  公開のたびに作るのかで、保管量が桁違いになる
   → 「本文と版を保管する」と決めた結果、新しく生じた論点

✗ Bad, because この記録ではデータ形式を確定していない
   → その記録で決めるべきだったこと。Issue が持つ
```

**時制** — `docs/README.md` の表に従う。

## Issue

**完了したときに何をデモできるかを、1文で言えること。** 言えないものは層（取得 / 型 / コンポーネント）で切っている。1つの薄い経路を全層に通す形へ切り直す。

段取りは本文のチェックリストで持つ。sub-issue に分けるのは、1件では扱えないと分かってからでよい。

要件本文を再掲しない。ID で参照する。

```
✓ 要件: FR-99
  ## 完了条件
  - 過去の版が一覧できる
  - 任意の版に戻せる

✗ ## 概要
  記事の版管理ができるようにする。過去の版を保持し…
   → 要件文書のコピー。要件が変わると嘘になる
```

## 検査の例外

`check.sh` の行単位の検査（リンク切れ・参照の向き・用語・Issue番号・decision-makers・原則リンク）が誤って指摘する行には、同じ行に `<!-- check-ignore: 理由 -->` を書く。文書単位の検査（冒頭宣言・目次・MADR）には効かない。

```
| 要件 | [../REQUIREMENTS.md](../REQUIREMENTS.md) | <!-- check-ignore: 案内板 -->
```

例外の一覧は作らない。対象の行が消えれば例外も消えるようにする。

ディレクトリ単位の除外は `check.sh` 冒頭の `EXCLUDE_DIRS` が持つ。
