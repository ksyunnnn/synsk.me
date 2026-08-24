# Architecture Decision Records

重要な意思決定を記録し、なぜそう決めたかを後から辿れるようにする。

一覧はこのディレクトリのファイル名を見る。ファイル名は `NNNN-short-title.md`。

---

## 対象

**代替案があり、それを退けた決定のうち、覆すコストが高いものに限る。**

代替案があっても、書き換えれば覆せるものは ADR にしない。文書の書式に関する規定がこれにあたる（[.claude/rules/](../../.claude/rules/)）。

| 種類 | 置き場所 |
|------|---------|
| 要件（満たすべきこと） | [../REQUIREMENTS.md](../REQUIREMENTS.md) |
| 未決の疑問 | GitHub Issue（`question` ラベル） |
| 調査の記録 | [../research/](../research/) |
| 作業 | GitHub Issue |
| 文書の書式 | [.claude/rules/](../../.claude/rules/) |

要件は決定ではない。1つの決定から複数の要件が派生する。**ADR の単位は決定であって、要件ではない。**

書式と例は [.claude/rules/docs-patterns.md](../../.claude/rules/docs-patterns.md) にある。

---

## 書き方

1. [template.md](./template.md) をコピーして `NNNN-short-title.md` を作る
2. 番号は再利用しない
3. 承認後は決定内容を変更しない。覆すときは新しい ADR を書き、古い方の Status を `superseded` にする

### Status

| Status | 意味 |
|--------|------|
| `proposed` | 提案中 |
| `accepted` | 承認済み |
| `deprecated` | 非推奨（新規採用しない） |
| `superseded` | 置き換え済み（新しい ADR を参照） |

---

## References

- [Architecture Decision Records](https://adr.github.io/)
- [Michael Nygard's Original Post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [AWS ADR Best Practices](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
