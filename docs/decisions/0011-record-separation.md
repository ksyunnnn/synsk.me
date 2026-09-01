---
status: superseded by ADR-0017
date: 2026-08-21
decision-makers: synsk
---

# 記録の住み分けを定める

## Context and Problem Statement

同じ原因による失敗が2件観測された。

**進捗記録の停止。** `docs/ROADMAP.md` の Version History は 2026-02-03 が最後で、以後更新されなかった。Phase 2 の全項目が「未着手」のまま残った。この文書は Issue の状態を手で書き写す列を持っていた。

**決定記録による誤誘導。** 2026-08-20 に作成された `docs/adr/0007-duckdb-wasm-datastore.md` の Implementation Notes に、配信データの禁止事項が現在形で書かれた。その中には `content-model-design.md` で未決定のままの項目が含まれていた。2026-08-21 のセッションで、この記述が有効な決定として読まれ、議論が成立しなくなった。

両者の共通点は、**文書が現在の状態を語ろうとしたこと**である。一方は進捗を、他方は有効なルールを持とうとして、どちらも実態に追随できなくなった。

外部の調査から、判断に必要な事実を3つ得た。

- 古い仕様は仕様がない状態より有害である。エージェントは古い計画を、それが古いと気づかないまま実行し、異常を報告しない
- 文脈ファイルの陳腐化は3〜6ヶ月で顕在化する。`docs/ROADMAP.md` の停止期間はこの区間に入る
- 不要な記述はエージェントの成功率を下げる。無視されるからではなく、忠実に従われるからである

## Decision Drivers

* [余白 over 密度](../PRINCIPLES.md#1-余白-1)

## Considered Options

* 文書中心
* GitHub 中心
* 分離型（定義は文書、状態は GitHub）
* Spec-Driven Development ツールの導入
* 決定中心（ADR / RFD の拡張）
* 最小主義（コードを正本にする）

## Decision Outcome

**満たすべきことを語る文書を `docs/REQUIREMENTS.md` ひとつに限り、参照を変わりやすい側から変わりにくい側への一方向に固定する。**

```
Issue → REQUIREMENTS.md → adr/ → PRINCIPLES.md / VISION.md
```

- 各入れ物の役割と時制を `docs/README.md` に定義する
- ADR は決定だけを記録し、これから守るべきルール・未決事項・他文書の転記を持たない
- 状態は GitHub が持つ。Issue が作業を、Milestone がリリース単位のスコープを持つ
- Milestone をフェーズで区切らない。フェーズ型は前段の完了を後段の条件にするため、複数を並行して追えなくなる
- `docs/ROADMAP.md` を廃止する
- 手で維持する索引を作らない
- 要件の ID は通し番号とし、領域名を含めない。Issue が ID を参照するため、領域名を含めると後から分割できなくなる
- 文書の書式に関する規定は `.claude/rules/` に置き、ADR にしない。書き換えれば覆せるため

### Consequences

* Good, because 更新が止まっても文書が嘘にならない。進捗は GitHub が持つため、書き写す列が存在しない
* Good, because 古い ADR を有効なルールと読み違える経路が塞がれる。現在形を語る文書が1つに限られるため
* Good, because 参照の向きが一方向に固定されるため、リンクの張り忘れによる不整合が起きない
* Bad, because 全体像を把握するのに GitHub を開く必要がある。1ファイルを読めば済む形ではなくなる
* Bad, because 要件と Issue の対応を、要件 ID の参照で維持する手間が生じる
* Bad, because **`docs/notes/` が実質的な正本になる可能性。** 他文書から参照されない前提の場所だが、参照されれば削除できなくなる
* Bad, because **要件が増えたとき、通し番号だけでは見通しが悪くなる。** 領域で分けられないため、数が増えると一覧性が下がる

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: 文書中心

要件も進捗も git 内の文書に書く。

- **Pros**: 1ファイルを読めば全体が分かる
- **Cons**: 進捗が先に古くなり、同居する要件まで信用されなくなる。`docs/ROADMAP.md` で実際に起きた

### Option B: GitHub 中心

要件も進捗も Issue に置き、文書を最小にする。

- **Pros**: 状態が常に最新になる
- **Cons**: `ksyunnnn/synsk.me` の所有者が User のため issue types と issue fields が使えず、分類手段が label だけになる。横断して要件全体を読む手段も失われる

### Option C: 分離型（定義は文書、状態は GitHub）— 採用

- **Pros**: 腐りやすい部分を文書から追い出せる。ISO/IEC/IEEE 29148 のトレーサビリティ要求に沿う
- **Cons**: 二重管理の手間が生じる

### Option D: Spec-Driven Development ツールの導入

GitHub Spec Kit や AWS Kiro を使い、仕様から計画とタスクを生成する。

- **Pros**: 複数セッションにまたがる作業に強い。Claude Code に対応している
- **Cons**: 探索的な開発では破綻が早い。`constitution.md` が `docs/PRINCIPLES.md` と、`plan` が `docs/adr/` と役割が重複する

### Option E: 決定中心（ADR / RFD の拡張）— 採用

要件も決定として記録し、`superseded` で上書きする。

- **Pros**: 追記ではなく新規作成で更新するため、構造的に陳腐化しにくい
- **Cons**: 一覧性がない。満たすべきこと全体を読み取れない

### Option F: 最小主義（コードを正本にする）

型定義とコードを正とし、文書を作らない。

- **Pros**: 調査が示した「最小かつ正確」に最も近い
- **Cons**: 実装前の段階では、正本になるコードが存在しない

## More Information

- [ISO/IEC/IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html)
- [arc42 Section 10: Quality Requirements](https://docs.arc42.org/section-10/)
- [What spec-driven development gets wrong](https://www.augmentcode.com/blog/what-spec-driven-development-gets-wrong)
- [AGENTS.md Patterns: What Actually Changes Agent Behavior](https://blakecrosley.com/blog/agents-md-patterns)
- [GitHub Milestones as Release Payloads](https://tenthirtyam.org/dispatches/2026/05/10/github-milestones-as-release-payloads/)
- [ADR-0007: データストアに DuckDB WASM を採用する](./0007-duckdb-wasm-datastore.md)
