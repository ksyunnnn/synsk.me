# Documentation

> この文書は、どこに何を書くかの判断基準を持つ。個別の内容は各文書にある。

---

## Contents

- 入れ物と役割
- 参照の向き
- 判断に迷ったら
- Language Policy
- References

---

## 入れ物と役割

| 入れ物 | 語ること | 時制 | 書いてはいけないもの |
|--------|---------|------|---------------------|
| [VISION.md](./VISION.md) | なぜ作るか | 未来完了 | — |
| [PRINCIPLES.md](./PRINCIPLES.md) | 迷ったとき何を優先するか | 恒常 | — |
| [adr/](./adr/) | なぜそう決めたか | Decision は現在形 | これから守るべきルール、未決事項、他文書の転記 |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 何を満たすべきか | 現在形 | 進捗、Issue 番号、実装方法 |
| [archive/](./archive/) | 過去の記録 | — | — |
| [scraps/](./scraps/) | それ以外 | 制約なし | — |
| GitHub Issue | 何をやるか | 未完了 | 要件本文の再掲 |
| GitHub Milestone | どのリリースに含めるか | — | 要件の定義 |
| [../README.md](../README.md) | このリポジトリが何で、どう動かすか | 恒常 | 設計の判断基準、進捗 |
| [CLAUDE.md](../CLAUDE.md) | プロジェクト固有の作業ルール | 恒常 | コードから導出できること |
| [.claude/rules/writing.md](../.claude/rules/writing.md) | 全出力に適用する文章ルール | 恒常 | 特定の文書だけに効くもの |
| [.claude/rules/docs-patterns.md](../.claude/rules/docs-patterns.md) | 文書の書式と例 | 恒常 | 役割と時制の定義 |
| [.claude/agents/](../.claude/agents/) | エージェントの役割・立場・手順 | 恒常 | 基準の内容 |
| [.claude/skills/](../.claude/skills/) | skill の起動手順と結果の扱い | 恒常 | 観点と判定手順 |

`archive/` は書き換えない。規約から外れていても直さない。調べたことは ADR の Context が持つ。

---

## 参照の向き

**変わりやすい側から変わりにくい側へ。一方向のみ。**

```
Issue → REQUIREMENTS.md → adr/ → PRINCIPLES.md / VISION.md
```

逆向きは張らない。リンクと ID 参照の両方に適用する。例外は1つ。**ディレクトリの `README.md` は案内板なので、どこへでもリンクしてよい。**

ここから次が導かれる。

- REQUIREMENTS.md に Issue 番号を書かない。Issue は増え続けるため
- adr/ に要件を書かない。ADR は変えないため、要件が変わると嘘になる
- 各文書の冒頭宣言に他文書へのリンクを含めない
- 手で維持する索引を作らない

`scraps/` はこの図に入らない。

判断の根拠は [adr/0011-record-separation.md](./adr/0011-record-separation.md) にある。

---

## 判断に迷ったら

**要件か、作業か。**
実装が終わっても残るなら要件。終われば閉じるなら作業。1つの要件に対して作業は複数生まれる。

**決定か、要件か。**
代替案があり、それを退けた決定のうち、覆すコストが高いものが ADR。満たすべき性質を述べているだけなら要件。

**要件か、疑問か。**
現在形で「〜できる」と書けるなら要件。要るかどうか分からないなら疑問（`question` ラベルの Issue）。

**規則をどこに置くか。**
全出力に効かせたいなら `.claude/rules/writing.md`。文書を書くときだけでよいなら `.claude/rules/docs-patterns.md`（`paths` 指定により、`docs/**` を読んだときだけロードされ、`/compact` 後は再注入されない）。それ以外のプロジェクト固有の作業ルールは `CLAUDE.md`。

---

## Language Policy

- ファイル名・見出し: 英語
- 本文: 日本語

---

## References

このドキュメント構成は以下に基づく。

- **Vision**: [Amazon Working Backwards](https://workingbackwards.com/)
- **Principles**: [Ray Dalio's Principles](https://www.principles.com/) + X over Y 形式
- **ADR**: [Architecture Decision Records](https://adr.github.io/)
- **同じ事実を2か所に書かない**: [arc42 Section 10](https://docs.arc42.org/section-10/)
- **要件の階層とトレーサビリティ**: [ISO/IEC/IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html)
