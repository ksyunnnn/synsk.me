---
status: accepted
date: 2026-09-16
decision-makers: synsk
consulted: Claude
---

# 設計原則とデザインパターンを SOFTWARE_DESIGN.md に置き、constitution に写す

## Context and Problem Statement

2026-09-15 の時点で、`docs/README.md` の「入れ物と役割」の表に、守る決まりそのもの（ディレクトリの形、依存の向き）を置く入れ物はなかった。決めた理由は `docs/decisions/` に書く。

2026-09-15 に、設計原則・デザインパターン・コード規約は分けて置き、参照は一方向にする（コード規約 → デザインパターン → 設計原則）と決めた。コード規約は静的解析の設定そのものとする（ADR-0033）。2026-09-16 に、理由は原則が持ち、パターンは形を持つとし、参照はパターンから原則への一方向とした。UI の原則は `docs/PRINCIPLES.md` の Design Principles が持つ。

設計原則は 9 つ（ADR-0031）、デザインパターンは 9 つ（ADR-0032）ある。規則を 1 ファイルで公開している実例として、TigerBeetle の TigerStyle は約 60 項目、Chromium の //chrome/browser design principles は 33 項目を持つ。GitLab は Software design guides を `software_design.md` に置く。

constitution は `/speckit-plan` のゲートが読む。v1.0.0 の Core Principles は、Test Layering、Display Speed、Cacheability、Allowlist Visibility の 4 つだった。

## Considered Options

* 設計原則とデザインパターンを 1 ファイルに置く
* 設計原則とデザインパターンを別のファイルに置く

## Decision Outcome

**設計原則とデザインパターンを `docs/SOFTWARE_DESIGN.md` の 1 ファイルに置く。constitution の Core Principles は、設計原則を `plan.md` で判定できる形に写したものとする。**

### 置き場

- 1 ファイルにする。原則 9 つとパターン 9 つは、1 ファイルで公開している実例（TigerBeetle 約 60 項目、Chromium 33 項目）より少ない
- ファイル名は GitLab の `software_design.md` に合わせる
- 冒頭で「この文書は、コードの判断の軸（設計原則）と、形の定番（デザインパターン）を書く。なぜそう決めたかは書かない。」と宣言する
- `docs/README.md` の「入れ物と役割」に行を足す

### constitution

`/speckit-constitution` を「既存の constitution を作り直す。既存の実装指針 docs/SOFTWARE_DESIGN.md がある」の入力で実行し、v2.0.0（MAJOR）に作り直す。

- Core Principles: 設計原則 1〜9 を、`plan.md` で判定できる形にした 9 つ
- Decided Constraints: v1.0.0 の 4 原則（Test Layering、Display Speed、Cacheability、Allowlist Visibility）を移す。根拠は ADR の ID のまま
- Governance: Core Principles の出典は `SOFTWARE_DESIGN.md`、Decided Constraints の根拠は `docs/decisions/` と書き分ける

Core Principles と `SOFTWARE_DESIGN.md` の設計原則は、同じ内容を別の形で持つ。constitution は `/speckit-plan` のゲートが読むため、判定できる形で持つ必要がある。設計原則が変わったときに、`/speckit-constitution` で作り直す。

`docs/README.md` の「入れ物と役割」の constitution の行に、Core Principles は `SOFTWARE_DESIGN.md` の設計原則を判定できる形に写したもので、設計原則が変わったときに作り直すことを書く。

### Consequences

* Bad, because Core Principles と設計原則は同じ内容を別の形で持ち、設計原則が変わったときに constitution を作り直す必要がある
* Bad, because v2.0.0 を作った `/speckit-constitution` の実行で、設計原則にない文言が 3 か所に足された（I「作り手以外がその経路を通れないことを確かめる検査を書く」、II「量と回数の上限の値を書く」、VIII「使う箇所と、閉じ込めるモジュールを書く」）
### Confirmation

constitution の Core Principles の各原則は、「出典: 設計原則 N」で対応する設計原則を示す。設計原則と Core Principles の中身が対応しているかを機械的に判定する手段はない。`check.sh` は `.specify` を対象外にしているため、constitution は機械的に検査されない。

## More Information

- [TigerBeetle: TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md)
- [Chromium: //chrome/browser design principles](https://chromium.googlesource.com/chromium/src/+/main/docs/chrome_browser_design_principles.md)
- [GitLab: Software design guides](https://gitlab.com/gitlab-org/gitlab/-/blob/master/doc/development/software_design.md)

関連する決定の記録

- [ADR-0031: 設計原則を ISO/IEC 25010 の品質特性ごとに 1 つ置く](./0031-design-principles-by-iso25010.md)
- [ADR-0032: デザインパターンの基本を 9 つ置き、中身が合うものだけ一般名で呼ぶ](./0032-basic-design-patterns.md)
- [ADR-0033: コード規約を静的解析の設定そのものにする](./0033-code-conventions-as-static-analysis.md)
