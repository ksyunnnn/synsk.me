---
status: accepted
date: 2026-09-01
decision-makers: synsk
consulted: Claude
---

# 満たすべきことの置き場を機能の範囲で分ける

## Context and Problem Statement

2026-08-21 に、満たすべきことを語る文書を `docs/REQUIREMENTS.md` ひとつに限ると決めた。Spec-Driven Development ツールの導入は採らなかった。理由は2つある。探索的な開発では破綻が早いこと、`constitution.md` が `docs/PRINCIPLES.md` と、`plan` が決定の記録と役割で重複することである。

2026-08-29 の `2cf66b9` が `docs/README.md` に `spec.md` の行を加え、参照の向きに挿入した。2026-09-01 に specify-cli 1.0.1 で Spec Kit を導入し、`specs/001-notes-list-detail/spec.md` を実体として書いた。

満たすべきことを語る文書が2つになり、ひとつに限る形は成立しない。

## Decision Drivers

* [余白 over 密度](../PRINCIPLES.md#1-余白-1)

## Considered Options

* `REQUIREMENTS.md` ひとつに保ち、Spec Kit を使わない
* `REQUIREMENTS.md` と `spec.md` に分ける
* `spec.md` に一本化し、`REQUIREMENTS.md` を廃止する

## Decision Outcome

**満たすべきことを語る文書を `docs/REQUIREMENTS.md` と `spec.md` の2つとし、機能をまたぐかどうかで分ける。参照は変わりやすい側から変わりにくい側への一方向に固定する。**

```
Issue → spec.md → REQUIREMENTS.md → decisions/ → PRINCIPLES.md / VISION.md
```

- 機能を足すたびに問い直されるものは `REQUIREMENTS.md`、その機能を作り終えたら閉じるものは `spec.md` が持つ
- 決定の記録は機能をまたいで効くものに限る。その機能で閉じる決定は `spec.md` と `plan.md` が持つ
- 決定の記録は決定だけを持ち、これから守るべきルール・未決事項・他文書の転記を持たない
- 外部ツールが配り、人が書き足さないファイルは、入れ物の表の対象外とする
- 各入れ物の役割と時制を `docs/README.md` に定義する
- 進捗を語る文書を持たない。状態は GitHub が持ち、Issue が作業を、Milestone がリリース単位のスコープを持つ
- Milestone をフェーズで区切らない。フェーズ型は前段の完了を後段の条件にするため、複数を並行して追えなくなる
- 手で維持する索引を作らない
- 要件の ID は通し番号とし、領域名を含めない。Issue が ID を参照するため、領域名を含めると後から分割できなくなる
- 文書の書式に関する規定は `.claude/rules/` に置き、決定の記録にしない。書き換えれば覆せるため

### Consequences

* Good, because 機能で閉じる要件が `REQUIREMENTS.md` に積み上がらない
* Good, because 仕様から計画とタスクを生成する経路が定まり、複数セッションにまたがる作業を引き継げる
* Bad, because 満たすべきこと全体を1つの文書で読めない
* Bad, because **要件の ID が2つの文書で衝突しうる。** どちらも `FR-NN` の形を取る
* Bad, because **`.specify/memory/constitution.md` が `docs/PRINCIPLES.md` と、`plan.md` が決定の記録と役割で重なる。**
* Bad, because 機能をまたぐかどうかの判定が、次の機能を足すまで確定しない

### Confirmation

`check.sh` の `[参照の向き]` 検査が、変わりにくい側から変わりやすい側へのリンクを検出する。置き場の振り分けそのものには判定手段がない。機能をまたぐ要件かどうかを機械で判定する方法が思いつかなかった。

## Pros and Cons of the Options

**Option A: `REQUIREMENTS.md` ひとつに保ち、Spec Kit を使わない** — 満たすべきこと全体を1つの文書で読める。機能で閉じる要件も積み上がり、その機能を作り終えても残る。2026-08-21 に採った形。

**Option B: `REQUIREMENTS.md` と `spec.md` に分ける — 採用** — 機能で閉じる要件が横断の文書に残らない。置き場の振り分けを毎回判定することになる。

**Option C: `spec.md` に一本化し、`REQUIREMENTS.md` を廃止する** — 置き場が1つに戻る。機能をまたぐ要件の置き場がなくなり、同じ要件が複数の `spec.md` に重複する。

## More Information

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Spec Kit: Spec-Driven Development](https://github.com/github/spec-kit/blob/main/spec-driven.md)
