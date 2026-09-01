# Decisions

なぜそう決めたかを後から辿れるようにする。

一覧はこのディレクトリのファイル名を見る。ファイル名は `NNNN-short-title.md`。

---

## 対象

**重要な決定を記録する。ただし機能をまたいで効くものに限る。**
その機能で閉じるものは `spec.md` と `plan.md` が持つ。

MADR は対象を絞らない（[Overview](https://adr.github.io/madr/)）。範囲を限るのは置き場所が `decisions/` だけではないため。

| 種類 | 置き場所 |
|------|---------|
| 要件（満たすべきこと） | [../REQUIREMENTS.md](../REQUIREMENTS.md) |
| 未決の疑問 | GitHub Issue（`question` ラベル） |
| 作業 | GitHub Issue |
| 文書の書式 | [.claude/rules/](../../.claude/rules/) |

要件は決定ではない。1つの決定から複数の要件が派生する。**単位は決定であって、要件ではない。**

デザインの採用版は `design/*.pen` が持つ。この記録が持つのは、なぜその案にしたかである。

書式と例は [.claude/rules/docs-patterns.md](../../.claude/rules/docs-patterns.md) にある。

---

## 書き方

1. [template.md](./template.md) をコピーして `NNNN-short-title.md` を作る
2. 番号は再利用しない
3. 承認後は決定内容を変更しない。覆すときは新しい記録を書き、古い方の status を `superseded by ADR-NNNN` にする

### Status

| Status | 意味 |
|--------|------|
| `proposed` | 提案中 |
| `accepted` | 承認済み |
| `rejected` | 却下 |
| `deprecated` | 非推奨（新規採用しない） |
| `superseded by ADR-NNNN` | 置き換え済み |

---

## References

- [MADR](https://adr.github.io/madr/)
- [Markdown Architectural Decision Records: Format and Tool Support](https://ceur-ws.org/Vol-2072/paper9.pdf)
- [Architecture Decision Records](https://adr.github.io/)
- [Michael Nygard's Original Post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
