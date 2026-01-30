# Pencil MCP 運用ガイド

> Pencil MCP を Claude Code から利用する際の運用知見と検証結果

---

## 概要

[Pencil](https://www.pencil.dev/) は IDE 内で動作するデザインツールで、MCP（Model Context Protocol）を通じて AI アシスタントと連携できる。本ドキュメントは Claude Code から Pencil MCP を利用する際の実践的な運用ガイドである。

### 検証環境

- Pencil: pencil.dev（SaaS版、2026年1月時点）
- Claude Code: Opus 4.5
- MCP 接続: WebSocket
- OS: macOS

---

## アーキテクチャ制約

Pencil MCP は Pencil エディタの拡張として動作するため、以下の制約がある：

| 操作 | MCP 単独 | エディタ併用 |
|------|----------|--------------|
| 読み取り | ❌ | ✅ |
| 編集 | ❌ | ✅ |
| 保存 | ❌ | ✅（手動） |

**結論**: Pencil アプリを起動せずに .pen ファイルを編集・保存することはできない。

---

## 運用ルール

### DO（推奨）

| 操作 | 方法 |
|------|------|
| デザイン作成・編集 | `batch_design` ツール |
| デザイン読み取り | `batch_get` ツール |
| 表示確認 | `get_screenshot` ツール |
| 新規ドキュメント作成 | `open_document("new")` → ユーザーが手動保存 |
| ファイルを開く | `open_document(絶対パス)` ※タイムアウトエラーは無視 |
| **ファイル保存** | **ユーザーが手動で Cmd+S / Cmd+Shift+S** |

### DON'T（非推奨）

| 操作 | 理由 |
|------|------|
| `Write` ツールで .pen を直接保存 | Pencil が読み込めない形式になる |
| Pencil エディタを閉じた状態で MCP 操作 | WebSocket 接続が切れる |
| 相対パスで `open_document` | 動作が不安定 |

---

## フレーム配置の注意点

### 問題: 兄弟フレーム間の重なり

MCP で新しいフレームを挿入する際、座標を明示的に指定しないと既存フレームと重なる可能性がある。

**検出方法**:
```
snapshot_layout(maxDepth=0) でトップレベルフレームの座標を確認
```

**注意**: `problemsOnly=true` は親子間のクリッピングのみ検出。兄弟間の重なりは検出しない。

### 推奨ワークフロー

1. **新規フレーム挿入前**: `snapshot_layout(maxDepth=0)` で既存フレームの範囲を確認
2. **座標計算**: 既存フレームの `y + height` より下、または `x + width` より右に配置
3. **挿入後**: 再度 `snapshot_layout` で重なりがないか確認

### 例: 安全な配置

```javascript
// 既存フレームの下に配置する場合
// snapshot_layout の結果: [{id: "frame1", y: 0, height: 800}, ...]
// → 新規フレームは y: 900（800 + マージン100）以降に配置

newFrame=I(document, {type: "frame", x: 0, y: 900, ...})
```

### チェックリスト

- [ ] 挿入前に `snapshot_layout(maxDepth=0)` を実行したか
- [ ] 既存フレームの座標範囲を確認したか
- [ ] 十分なマージン（50-100px）を確保したか
- [ ] 挿入後に目視またはスクリーンショットで確認したか

---

## 主要ツール

### get_editor_state

エディタの現在状態を取得する。作業開始時に必ず呼び出す。

**パラメータ**: `include_schema: false`（スキーマ不要の場合）

**返却情報**:
- 現在開いているファイルパス
- トップレベルノード一覧
- 再利用可能コンポーネント一覧

### batch_design

デザイン操作を実行する。1回の呼び出しで最大25操作まで。

**操作タイプ**:
- `I()` - Insert（挿入）
- `U()` - Update（更新）
- `R()` - Replace（置換）
- `C()` - Copy（コピー）
- `D()` - Delete（削除）
- `M()` - Move（移動）
- `G()` - Generate image（画像生成）

### batch_get

ノード情報を取得する。`readDepth` でネストの深さを指定。

### open_document

ファイルを開く。**必ず絶対パスを使用する**。

```
filePathOrTemplate: "/absolute/path/to/file.pen"
```

**注意**: タイムアウトエラーが返されても、実際にはファイルは開かれている。

### get_screenshot

指定ノードのスクリーンショットを取得する。デザイン確認に使用。

---

## トラブルシューティング

### WebSocket not connected エラー

**原因**: Pencil エディタが起動していない、または閉じられた

**解決策**:
1. Pencil エディタを起動する
2. Claude Code を再起動する

### Timeout waiting for document エラー

**原因**: MCP の応答待ち時間超過（実際には成功している場合が多い）

**解決策**:
1. `get_editor_state` で状態を確認
2. ファイルが開かれていれば問題なし

### .pen ファイルが Pencil で表示されない

**原因**: Write ツールで直接保存した、または JSON フォーマットが不正

**解決策**:
1. MCP 経由で新規作成し直す
2. ユーザーが手動で保存する

---

## 検証ログ

### 検証日: 2026-01-30

#### 検証1: open_document の動作

| 条件 | 結果 |
|------|------|
| `open_document("new")` | ✅ 正常動作 |
| `open_document(相対パス)` - エディタでファイル開いている状態 | ⚠️ 不安定 |
| `open_document(絶対パス)` - エディタ起動中 | ✅ 動作（タイムアウトエラーは返る） |
| `open_document(絶対パス)` - エディタ閉じた状態 | ❌ WebSocket 切断 |
| 既に開いているファイルを再度 open | ✅ 問題なし（状態維持） |
| 別のファイルを open | ✅ 正常に切り替わる |

#### 検証2: ファイル保存

| 方法 | 結果 |
|------|------|
| MCP で作成 → ユーザーが手動保存 | ✅ 正常 |
| Write ツールで JSON 直接書き込み | ❌ Pencil が読み込めない |

#### 検証3: 元の foundations.pen の問題

- JSON としては正常（Read ツールで読み取り可能）
- MCP の `batch_get` でも内容取得可能
- Pencil エディタで表示不可
- **推測**: Pencil エディタの内部キャッシュまたはメタデータの不整合
- **回避策**: MCP で新規作成 → 手動保存 で再作成

---

## 公式ドキュメントとの差分

Pencil MCP の公式ガイドライン（`get_guidelines` で取得可能）には以下が記載されている：

- .pen ファイルの JSON スキーマ
- batch_design / batch_get の使用方法
- コンポーネント、レイアウト、スタイルのガイドライン
- コード生成のベストプラクティス

**記載されていない項目**（本ドキュメントで補完）:

- `open_document` の動作仕様と注意点
- ファイル保存の方法（手動保存が必要）
- MCP 接続の要件（エディタ起動必須）
- Write ツールでの直接保存の問題

---

## 参考リンク

- [Pencil 公式サイト](https://www.pencil.dev/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
