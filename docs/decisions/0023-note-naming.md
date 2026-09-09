---
status: accepted
date: 2026-09-09
decision-makers: synsk
consulted: Claude
---

# synsk.me が持つ記事を note と呼ぶ

## Context and Problem Statement

同じ対象が3つの語で呼ばれている。2026-09-09 に `docs/` と `specs/` を検索して数えた。

| 語 | 現れる場所 |
|---|---|
| internal コンテンツ | `docs/REQUIREMENTS.md` に5箇所、`docs/decisions/` に7箇所 |
| 記事 | `docs/decisions/` に8箇所（外部プラットフォームの記事を指すものを除く） |
| note | `specs/001-notes-list-detail`、`specs/003-note-editor` |

[.claude/rules/writing.md](../../.claude/rules/writing.md) の S4 が「用語を1つに固定する」と定める。

3つの語はいずれも対象を過不足なく指さない。

**「記事」は種別 `article` を指す語と衝突する。** `article` は Zenn・Qiita・dev.to・Medium・internal の5つのプラットフォームに割り当たる種別であり、外部から取得したものを含む（[archive/content-model-design.md](../archive/content-model-design.md)）。

**「internal コンテンツ」の `internal` は `Platform` の値であり、種別を指さない。** `platform` が `internal` のもののうち、種別が `article` のものだけが対象である。

## Decision Drivers

* [.claude/rules/writing.md](../../.claude/rules/writing.md) の S4「用語を1つに固定する」

## Considered Options

* 「internal コンテンツ」に統一する
* 「記事」に統一する
* 「note」に統一する

## Decision Outcome

**synsk.me が持つ記事を note と呼ぶ。note は `platform` が `internal` で、種別が `article` のものを指す。**

- 「internal コンテンツ」を使わない
- note を指して「記事」を使わない。外部プラットフォームの記事を指す「記事」は残す
- ADR-0022 までの記録に現れる「internal コンテンツ」は、`platform` が `internal` のすべてを指す。note と範囲が一致するのは、`internal` に `article` 以外の種別が存在しない間に限る

### Consequences

* Good, because 外部から取得した `article` と、synsk.me が持つものを語で区別できる
* Good, because `docs/decisions/README.md` が定める「承認後は決定内容を変更しない」に触れずに済む。ADR-0016 の「permalink を持つのは internal コンテンツ、project、職務経歴書とする」を note へ置き換えると、`internal` かつ `article` でないものが決定の範囲から外れる
* Bad, because ADR-0022 までの記録は「internal コンテンツ」のままであり、読者は2つの語に出会う。対応はこの記録が持つ
* Bad, because `internal` に `article` 以外の種別を足すとき、この記録の範囲の記述を見直すことになる

### Confirmation

`.claude/skills/auditing-docs-convention/scripts/check.sh` に用語の検査は無い。判定は `docs/REQUIREMENTS.md` と `specs/` を対象に `grep -rn 'internal コンテンツ'` を実行し、出力が空であることによる。ADR-0022 までの記録は対象に含めない。

## Pros and Cons of the Options

### 「internal コンテンツ」に統一する

* Good, because 記録での使用箇所がもっとも多く、書き換えが最小になる
* Bad, because `internal` は `Platform` の値であり、種別を含意しない。`platform` が `internal` で `article` でないものを排除できない
* Bad, because データモデルの語をそのまま外に出しており、要件の読み手に構造の知識を要求する

### 「記事」に統一する

* Good, because 日本語として読みやすい
* Bad, because 種別 `article` の訳語と衝突する。`article` は外部プラットフォームのものを含むため、「記事」では synsk.me が持つものを特定できない

### 「note」に統一する — 採用

* Good, because `/notes` という経路（ADR-0016）と一致する
* Good, because `specs/001-notes-list-detail` と `specs/003-note-editor` が既にこの語を使っている
* Bad, because ADR-0022 までの記録との対応を、この記録が持つことになる

## More Information

- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0016: URL の規則](./0016-url-conventions.md)
- [.claude/rules/writing.md](../../.claude/rules/writing.md)
