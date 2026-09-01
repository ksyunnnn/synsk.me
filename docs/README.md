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
| [decisions/](./decisions/) | なぜそう決めたか | `## Decision Outcome` は現在形 | これから守るべきルール、未決事項、他文書の転記 |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 機能をまたいで満たすべきこと | 現在形 | 進捗、Issue 番号、実装方法、1つの機能で閉じる要件 |
| `../specs/<機能ディレクトリ>/spec.md` | その機能で満たすべきこと | 現在形 | 機能をまたぐ要件（`REQUIREMENTS.md` が持つ） |
| [archive/](./archive/) | 過去の記録 | — | — |
| [scraps/](./scraps/) | それ以外 | 制約なし | — |
| GitHub Issue | 何をやるか | 未完了 | 要件本文の再掲 |
| GitHub Milestone | どのリリースに含めるか | — | 要件の定義 |
| [../README.md](../README.md) | このリポジトリが何で、どう動かすか | 恒常 | 設計の判断基準、進捗 |
| [CLAUDE.md](../CLAUDE.md) | プロジェクト固有の作業ルール | 恒常 | コードから導出できること |
| [.claude/rules/writing.md](../.claude/rules/writing.md) | 全出力に適用する文章ルール | 恒常 | 特定の文書だけに効くもの |
| [.claude/rules/docs-patterns.md](../.claude/rules/docs-patterns.md) | 文書の書式と例（テンプレートを持つものはテンプレートが持つ） | 恒常 | 役割と時制の定義 |
| [.claude/agents/](../.claude/agents/) | エージェントの役割・立場・手順 | 恒常 | 基準の内容 |
| [.claude/skills/](../.claude/skills/) | skill の起動手順と結果の扱い | 恒常 | 観点と判定基準（`scripts/` は除く） |

`archive/` は書き換えない。規約から外れていても直さない。調べたことは決定の記録の Context が持つ。

入れ物ごとに役割と時制を定めるという方針の根拠は [decisions/0017-requirement-placement.md](./decisions/0017-requirement-placement.md) にある。

外部ツールが配り、人が書き足さないファイルは、上の表の対象外とする。手で書き換えない。`.specify/` と `.claude/skills/speckit-*` がこれに当たる。`specs/` 配下は人が書くため対象に含む。

---

## 参照の向き

**変わりやすい側から変わりにくい側へ。一方向のみ。**

```
Issue → spec.md → REQUIREMENTS.md → decisions/ → PRINCIPLES.md / VISION.md
```

`spec.md` の位置は Spec Kit の公式に根拠を持たない。公式が定めるのは生成の順序（Spec → Plan → Tasks → Implement）であり、`spec.md` が機能をまたぐ要件文書を参照してよいかは書かれていない。

逆向きは張らない。リンクと ID 参照の両方に適用する。例外は1つ。**ディレクトリの `README.md` は案内板なので、どこへでもリンクしてよい。**

ここから次が導かれる。

- REQUIREMENTS.md に Issue 番号を書かない。Issue は増え続けるため
- decisions/ に要件を書かない。決定の記録は変えないため、要件が変わると嘘になる
- 各文書の冒頭宣言に他文書へのリンクを含めない
- 手で維持する索引を作らない

`scraps/` はこの図に入らない。

判断の根拠は [decisions/0017-requirement-placement.md](./decisions/0017-requirement-placement.md) にある。

---

## 判断に迷ったら

**要件か、作業か。**
実装が終わっても残るなら要件。終われば閉じるなら作業。1つの要件に対して作業は複数生まれる。

**決定か、要件か。**
なぜそう決めたかを述べるなら決定（`decisions/`）。満たすべき性質を述べているだけなら要件。

**決定をどこに置くか。**
機能をまたいで効くなら `decisions/`。その機能で閉じるなら `spec.md` と `plan.md`。

**要件をどこに置くか。**
機能を足すたびに問い直されるなら `REQUIREMENTS.md`。その機能を作り終えたら閉じるなら `spec.md`。

```
✓ ## FR-11: 永続化したデータを完全に削除できる
   → データを持つ機能を足すたびに問い直される

✓ ## FR-16: スマートフォンから internal コンテンツを作成・編集・公開できる
   → 編集機能を足すたびに問い直される

✗ ## FR-99: career と project から職務経歴書を出力できる
   → 出力機能で閉じる。spec.md が持つ

✗ ## FR-99: internal コンテンツに画像などのメディアを含められる
   → エディタで閉じる。spec.md が持つ
```

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
- **決定の記録**: [Architecture Decision Records](https://adr.github.io/) / [MADR](https://adr.github.io/madr/)
- **同じ事実を2か所に書かない**: [arc42 Section 10](https://docs.arc42.org/section-10/)
- **要件の階層とトレーサビリティ**: [ISO/IEC/IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html)
