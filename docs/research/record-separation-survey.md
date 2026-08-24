# 記録の住み分けに関する調査

> この文書は決定の正本ではない。決定は docs/adr/ にある。

2026-08-21 に記録の住み分けを決めるにあたって調べたことの記録。結論はこの文書に書かない。

## Contents

- Claude Code のロードと再注入
- GitHub でこのリポジトリに使えるもの
- 要件管理の手法と反証
- AI エージェント向け文書の実測研究
- Issue の粒度
- Milestone の型
- 出典

---

## Claude Code のロードと再注入

公式ドキュメントの記述と、動作の確認による。

| 置き場所 | 起動時 | `/compact` 後の再注入 |
|---|---|---|
| `CLAUDE.md`（プロジェクトルート） | ロード | される |
| `.claude/rules/`（`paths` なし） | ロード | される |
| `.claude/rules/`（`paths` あり） | されない | されない |
| サブディレクトリの `CLAUDE.md` | されない | されない |
| Skill の description 一覧 | ロード | **されない** |
| Skill 本体 | されない | 呼んだものだけ残る |
| Auto memory `MEMORY.md` | 先頭200行 / 25KB | される |

`paths` 付きルールとサブディレクトリの `CLAUDE.md` は、次にマッチするファイルを読んだときに再ロードされる。ターミナルには内容ではなく「Loaded」の1行通知だけが出る。

`paths` なしルールが再注入される点は、公式が「サブディレクトリの CLAUDE.md と `paths:` 付きルールは自動再注入されない」と限定して書いていることからの読み取り。明示された記述ではない。

**その他の記述**

- `CLAUDE.md` は200行以下が推奨。長いほど遵守率が下がる
- `CLAUDE.md` はシステムプロンプトではなくユーザーメッセージとして配信されるため、厳密な遵守は保証されない
- 矛盾する指示があると、どちらか一方が任意に選ばれる
- `@import` は起動時に展開されて全部ロードされる。コンテキスト削減にはならない
- Claude Code は `AGENTS.md` を読まない。`@AGENTS.md` の import か symlink が公式の回避策
- 強制が必要なら hook。「Settings rules are enforced by the client regardless of what Claude decides to do. CLAUDE.md instructions shape Claude's behavior but are not a hard enforcement layer.」
- `InstructionsLoaded` hook で、どの指示ファイルがいつロードされたかをログできる
- Skill の `description` と `when_to_use` の合計は、一覧で1,536文字に切り詰められる

---

## GitHub でこのリポジトリに使えるもの

2026-08-21 に API を叩いて確認した。所有者が Organization ではなく User であることが効いている。

| 機能 | 可否 | 確認方法・制限 |
|---|---|---|
| Sub-issues | 使える | `/repos/ksyunnnn/synsk.me/issues/14/sub_issues` が `[]` を返す。1親あたり100件、8階層まで |
| Milestones | 使える | エンドポイント正常 |
| Labels | 使える | デフォルト9個 |
| Projects v2 | 使える | ユーザーレベル |
| Issue types | **使えない** | `/orgs/ksyunnnn/issue-types` が 404。owner type が `User` |
| Issue fields | **使えない** | 公式チェンジログ（2026-07-02 GA）が Organization 限定と明記 |

`gh` は 2.98.0 へ更新済み。sub-issue の操作に必要なのは 2.94.0 以降。

```
gh issue create --parent 100
gh issue edit 100 --add-sub-issue 123,124
gh issue edit 23 --add-blocked-by 200
```

`--type` は Organization の issue types が前提なので、このリポジトリでは効かない。

---

## 要件管理の手法と反証

### ISO/IEC/IEEE 29148:2018

要件工学の国際標準。要件を BRS（事業）→ StRS（ステークホルダー）→ SyRS（システム）→ SRS（ソフトウェア）の階層に分ける。トレーサビリティ（上位要件からの導出経路と、下位への割り当て経路を辿れること）を要求する。要件の書式は `[条件][主語][動作][対象][制約]` の5要素。

**反証**: 更新の契機が制度として組み込まれていない。レビュー体制のある組織を前提とした標準。

### arc42

アーキテクチャ文書のテンプレート。品質要件について「最重要のものは既に品質目標の節に記述されているので、ここでは参照するだけにすべき」と定める。同じ事実を2か所に書かない、が中核。docs-as-code を推奨。

**反証**: テンプレートが12章と重い。

### Spec-Driven Development（GitHub Spec Kit / AWS Kiro）

2025年に「vibe coding」— エージェントが意図から逸れ、API を幻覚し、規模とともに劣化する — への対抗として生まれた。Spec Kit は MIT ライセンスの CLI で Claude Code に対応。`/speckit.constitution → /speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement` という流れ。`/speckit.taskstoissues` でタスクを GitHub Issue に変換できる。

**反証**（複数の情報源が一致）:

- 探索的な開発では破綻が早い
- 小規模にはオーバーヘッドが見合わない
- 「**古い仕様は仕様がない状態より有害である。** エージェントは古い計画を、それが古いと気づかないまま自信を持って実行し、何かがおかしいと報告もしない」
- 仕様が擬似コードになると、プログラムを二度書くことになる

### RFD / RFC（Oxide Computer, Rust）

議論の単位ごとに番号付き文書を作る。Oxide は「Requests for Comments」ではなく「Requests for *Discussion*」と呼び、IETF 的な formal さとの混同を避けている。「polished より timely」を明示し、未成熟な段階から書くことを推奨。

**反証**: 一覧性がない。番号付き文書が増えると、満たすべきこと全体を横断して読めなくなる。

### Shape Up（Basecamp）

要件ではなく pitch を書く。「PRD が要件で他者を指示する文書なのに対し、pitch の目的は説得すること」。バックログを持たない。

**反証**: 顧客・市場調査の入力が欠けていると批判されている。永続的な要件台帳にならない。

### 最小主義（コードを正本にする）

meatup の `SPEC.md` が実践している形。「`src/lib/types.ts` を正とする」。データモデルを文書に書き写さず、コードを参照先にする。

**反証**: 実装前の段階では、正本になるコードが存在しない。

---

## AI エージェント向け文書の実測研究

### 書くほど良くなるわけではない

> LLM が生成した context ファイルはエージェントのタスク成功率を下げ、推論コストを20%以上増やす。開発者が書いたものでも改善はわずか +4%、しかも最小かつ正確な場合に限る。不要な要件は積極的に性能を害する。エージェントがそれを無視するからではなく、**忠実に従うから**である。

`AGENTS.md` についても同様の測定がある。

> LLM が生成した AGENTS.md は成功率を2%下げ、コストを23%増やした。主な原因は、**リポジトリに既にある内容を重複させたこと**である。

### Context drift の時定数

> 3〜6ヶ月あたりで、ファイルはコードベースの実態を正しく説明しなくなる。テストフレームワークが変わり、ライブラリが非推奨になり、ディレクトリ構成が変わる一方で、CLAUDE.md は前四半期の慣習に従うよう快活に指示し続ける。

### Anthropic の原則

コンテキストは「収穫逓減のある有限資源」であり、目指すのは「望む結果の確率を最大化する、最小の高シグナルトークン集合」。既定の前提は「Claude は既に賢い」で、各記述に「この段落はトークンコストに見合うか」を問えとされている。

**公式が挙げる書き方のアンチパターン**

- 時制に依存する情報（「2025年8月より前なら旧 API を使う」）。古い内容は `<details>` の「旧パターン」節へ隔離する
- 用語の揺れ（同じ対象を「field」「box」「element」と呼び分ける）
- 選択肢を並べる（「pypdf でも pdfplumber でも PyMuPDF でも」）。デフォルトを1つ示し、例外だけ添える
- 参照を2階層以上ネストさせる。Claude は `head` で部分読みして不完全な情報を得る
- 100行を超える参照ファイルに目次を置かない

**例は説明より効く**

> Examples convey the desired style and level of detail to Claude more clearly than descriptions alone.

**自由度を課題の性質に合わせる**

- High freedom（テキストの指示だけ）: 複数のアプローチが妥当なとき
- Low freedom（具体的なスクリプト）: 壊れやすくエラーが起きやすいとき、一貫性が critical なとき

**Claude A / Claude B のパターン**

> Claude A（設計者）と Claude B（実行者）を分ける。Claude A が指示を設計・改善し、Claude B が実際のタスクでそれを試す。観察した結果を Claude A に戻す。

> Create evaluations BEFORE writing extensive documentation.

### 案内板パターン

> ルートの AGENTS.md は簡潔な **router**（案内板）として使い、既に存在する人向けのプロジェクト文書へ誘導する。エージェント固有の資料は、タスクが必要とするときだけ参照させる。

> プロジェクト共通の真実は、README.md、CONTRIBUTING.md、docs/ といった目に見える慣習的な場所に置くべきである。

> エージェント固有の文脈（正確なテストのフラグ、触ってはいけないファイル）だけを AGENTS.md に置く。

なお `AGENTS.md` は Linux Foundation の Agentic AI Foundation が管理する標準で、60,000以上のリポジトリと20以上のツールが対応している。

### Diátaxis

技術文書を tutorials / how-to guides / technical reference / explanation の4つに分ける。

> 明確に分離しないと、1つの README がチュートリアル・思想・パラメータ仕様・問題解決を混ぜ込み、4つとも機能しなくなる。

### ADR と設計文書の違い

> ADR は設計文書より意図的に狭い。設計文書はシステムが存在する前に全体を提案し、**マージした時点で真でなくなる**。ADR は1つの選択を記録し、周囲のシステムが書き換えられた後も有効であり続ける。

> RFC は提案する。ADR は決定を記録する。設計文書は出来上がったシステムを記述する。

---

## Issue の粒度

### 層で切るのがアンチパターン

> 水平分割（UI、データベース、フロントエンド、バックエンドという**アーキテクチャの層**で切ること）は、INVEST の Independent と Valuable を満たさない。

> 垂直スライスは1つの薄い経路を全層に一度に通し、単体で検証できる。このルールを破ることが最も一般的な誤りで、結果もよく記録されている。あるチームは層で切った26枚のチケットを積み、事後分析であらゆる失敗の類型が水平分割に遡ることを突き止めた。

### 判定は1つの問いでできる

> このアンチパターンは「これが終わったとき、何をデモできるか」と問えば捕まえられる。**答えられないチケットは水平スライスである。**

### AI エージェント向けの実証研究

> マージされた PR は、短く、スコープが明確で、関連する成果物への手がかりと実装方針が示された Issue から生まれている。

> スコープが不明確な Issue は、エージェントがコードベースを走査しコマンドを実行するコストを払ったうえで、使えない結果を出す。

### 件数の見積もり

`content-model-design.md` の `Platform` は13個（`github` / `zenn` / `qiita` / `devto` / `connpass` / `medium` / `spotify` / `twitter` / `speakerdeck` / `techplay` / `codesandbox` / `codepen` / `internal`）。「◯◯ がタイムラインに並ぶ」の形で切ると最大13件。他の要件から出る作業を足しても30件前後の見込み。

垂直に切ると、1件目と2件目以降で中身の量が大きく違う。1件目は取得・型・コンポーネント・統合をすべて含み、2件目以降は取得部分の差し替えで済む。この形は Walking Skeleton と呼ばれる。

---

## Milestone の型

### Milestone の実体

> リポジトリに紐づく名前付きのコンテナ。Issue と PR を保持し、任意の説明と期限を持ち、閉じた項目と全項目の比から算出される進捗バーを表示する。

期限がなくても進捗バーは動く。ここが Label との違い。

### フェーズで分けるのはウォーターフォール

> フェーズ型のマイルストーンは、作業が特定の期間内に始まって終わり、順序が固定で、ある成果物が別の成果物の後に来ると仮定する。

> マイルストーンは複数を並行して追えるが、フェーズは前が終わらないと次に進めないことを含意する。

### Release milestone が本来の用途

> リリース用のマイルストーンは綺麗に保たれる。v1.2.0 に入っている Issue はすべて、人がそう判断したからそこにある。

### テーマ型の落とし穴

> テーマ型のマイルストーンは、一時的でスコープの決まった取り組みに対して最も有効である。恒久的な受け皿として使ってはいけない。整理されていないバックログと同じ失敗の仕方をする。

### Sprint 用途は道具が違う

GitHub Projects の Iterations が期間指定の本来の道具で、Milestone には日付範囲の機能がない。

---

## 出典

- [How Claude remembers your project — Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Explore the context window — Claude Code Docs](https://code.claude.com/docs/en/context-window)
- [Skill authoring best practices — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Issue fields are now generally available — GitHub Changelog](https://github.blog/changelog/2026-07-02-issue-fields-are-now-generally-available/)
- [Adding sub-issues — GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)
- [ISO/IEC/IEEE 29148-2018 — IEEE SA](https://standards.ieee.org/standard/29148-2018.html)
- [arc42 Section 10: Quality Requirements](https://docs.arc42.org/section-10/)
- [github/spec-kit](https://github.com/github/spec-kit)
- [Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [What spec-driven development gets wrong — Augment Code](https://www.augmentcode.com/blog/what-spec-driven-development-gets-wrong)
- [RFD 1: Requests for Discussion — Oxide Computer](https://rfd.shared.oxide.computer/rfd/0001)
- [AGENTS.md Patterns: What Actually Changes Agent Behavior](https://blakecrosley.com/blog/agents-md-patterns)
- [AGENTS.md Spec (2026): Recommended Sections](https://www.morphllm.com/agents-md-guide)
- [Context Engineering: A Practical Guide for AI Agents — Sourcegraph](https://sourcegraph.com/blog/context-engineering)
- [Diátaxis](https://diataxis.fr/)
- [Architecture Decision Records (ADRs): The 2026 Guide — Catio](https://www.catio.tech/blog/architecture-decision-record)
- [User Story Splitting - Vertical Slice vs Horizontal Slice](https://www.visual-paradigm.com/scrum/user-story-splitting-vertical-slice-vs-horizontal-slice/)
- [The /to-tickets Skill — AI Hero](https://www.aihero.dev/skills-to-tickets)
- [What Makes a GitHub Issue Ready for Copilot? (arXiv)](https://arxiv.org/html/2512.21426v1)
- [GitHub Milestones as Release Payloads](https://tenthirtyam.org/dispatches/2026/05/10/github-milestones-as-release-payloads/)
- [Risk-Based Milestones — PMI Disciplined Agile](https://www.pmi.org/disciplined-agile/agile/milestones)
