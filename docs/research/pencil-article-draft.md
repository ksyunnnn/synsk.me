# Pencil MCP 検証レポート（記事ドラフト）

> リデザイン作業中に知見を蓄積し、最終的に記事化する

---

## 記事の方向性

**仮タイトル**: 「Claude Code + Pencil MCP でデザインシステムを構築する」

**想定読者**: AI ツールとデザインの連携に興味があるエンジニア・デザイナー

**公開先**: Zenn / 個人ブログ

---

## 1. 背景・動機

### Figma ⇔ React 連携の課題

- Figma でデザイン → React で実装の往復が非効率
- デザイントークンの同期が手動になりがち
- AI アシスタント（Claude Code）がデザインファイルを直接編集できない

### Pencil を試した理由

- MCP（Model Context Protocol）対応で Claude Code から操作可能
- .pen ファイルは JSON ベースで透明性がある
- IDE 内で完結するワークフローが実現できる可能性

---

## 2. 検証内容

### セットアップ

[TODO: 手順を記載]

### 実際に作ったもの

- `design/foundations.pen` - デザイントークン定義
  - Colors（Light/Dark Mode）
  - Typography（Type Scale）
  - Spacing（Scale + Usage）
  - Variables 定義

### Claude Code との連携ワークフロー

[TODO: 実際のワークフローを記載]

---

## 3. 良かった点

- [ ] TODO: 作業中に追記

---

## 4. 課題・注意点

### 運用上の制約

- Pencil エディタを起動せずに MCP 操作はできない
- ファイル保存は手動（Cmd+S）が必要
- `open_document` はタイムアウトエラーを返すが実際は成功している

詳細: [pencil-mcp-guide.md](../pencil-mcp-guide.md)

### その他

- [ ] TODO: 作業中に追記

---

## 5. 結論

[TODO: 最終的な評価を記載]

---

## 知見メモ（作業中に追記）

<!--
リデザイン作業中に気づいたことをここに追記する。
最終的に上のセクションに整理して記事化する。
-->

### 2026-02-03

- 初版作成
- 既存の知見を pencil-mcp-guide.md から参照

---

## 参考リンク

- [Pencil 公式サイト](https://www.pencil.dev/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
- [pencil-mcp-guide.md](../pencil-mcp-guide.md) - 運用ガイド
- [ADR-0005: Design Tokens](../adr/0005-design-tokens.md) - デザイントークンの決定
