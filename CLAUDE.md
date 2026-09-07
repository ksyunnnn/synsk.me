# CLAUDE.md

synsk.me プロジェクトで Claude Code が従うルール。プロジェクトの概要と開発コマンドは `README.md` を参照。

## 作業ルール

### Git
- main への Push は必ず許可を得てから行う
- コミットは自由に行ってよい
- Push 前にセンシティブな情報が含まれていないか確認する

### ブランチ戦略
- 作業は `feature/*` ブランチで行い、main へ PR を作成する
- 実装の変更は Preview 環境で確認してからマージする。`docs/`・`.claude/`・`CLAUDE.md` だけの変更は Preview 確認を要さない
- デザインと実装は行き来しながら進める（工程を順番に消化する形は採らない）

### ワークスペース
- `desk-NN` は git worktree の常設ワークスペース。`repository/desk-01` のように main と並べて置く
- `desk-NN` ブランチにコミットを積まない。main を取り込むだけの受け皿とし、作業は `desk-NN` の中で `feature/*` を checkout して行う

### 分析・調査
- 一次ソース（元データ）での検証を重視する
- 外部の事実より、分析対象から読み取れる情報を優先する
- 事実に基づかない推測は、確認するか「推測」と明示する
- ツールやサービスの仕様を述べる前に、公式ドキュメントを確認する。記憶で断定しない

### 方法論提案
- 設計・実装の方法論を提案する際は、根拠となる思想や原則を明示する
- 公式ドキュメントへのリンクを添える
- 例: 「Atomic Design に基づき...」→ [公式サイト](https://atomicdesign.bradfrost.com/)

### spec

`specs/` 配下は `/speckit-specify` で作る。テンプレートを手でコピーしない。
既存の spec に要件を足す・直すときは `/speckit-clarify` を使う。仕様全体を書き直すときは `/speckit-specify` を再実行する。

詳細は [Spec Kit: Agentic SDD](https://github.com/github/spec-kit/blob/main/docs/reference/agentic-sdd.md) にある。

### ドキュメントの役割

どこに何を書くかの判断基準は `docs/README.md` にある。入れ物ごとの役割・時制・書いてはいけないもの、参照の向き、迷ったときの判断基準が集約されている。

書式と例は `.claude/rules/docs-patterns.md`、文章ルールは `.claude/rules/writing.md`。

### ドキュメント規約の監査

2段構えで行う。

**機械的検査** — 文書を変更したら `bash .claude/skills/auditing-docs-convention/scripts/check.sh` を実行する。出力された行はすべて違反である。

**監査人** — `auditing-docs-convention` skill を使う。実行コストが高いため、次のときに限る。

- 規約そのもの（`docs/README.md`、`.claude/rules/`、`docs/decisions/README.md`）を変更したとき
- 入れ物を追加・廃止・改名したとき
- PR を作る前

範囲は差分を既定とし、変更したファイルだけを対象にする。全体は `/auditing-docs-convention 全体` のようにユーザーが指定したときに限る。差分では観点 D（矛盾）・E（重複）・G（GitHub の整合）を実施しないため、決定の記録との矛盾は検出されない。

監査人が逸脱を指摘する。修正は許可を得てから行う。

## コミュニケーション

### 基本スタイル
- 日本語で応答する
- 「はい」は同意・続行の合図。詳細確認は不要
- 意見を求められたら率直に答える

### 質問形式
- 質問は `AskUserQuestion` ツールを使用したウィザード形式で行う
- 推測を含む判断は都度確認する

### エラー対応
- 誤りがあった場合は原因を説明する（解釈ミス / ソースの曖昧さ / その他）
- 修正指示は簡潔に来ることが多い。詳細は必要に応じて確認する

## デザイン作業

### Pencil (.pen) ファイルでの作業
- デザイン変更の提案時は、元のデザインを変更せず、新しいフレームとして追加する
- 差分がわかるように並べて比較できるようにする
- 例: `Timeline B` → `Timeline B: External Link Icon` のように派生版を作成
- 採用が決まったら、採用版を明示し、不要な派生版は整理する
