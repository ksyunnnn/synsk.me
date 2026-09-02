# CodePen

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `manual` |
| 経路 | 手動登録 |
| エンドポイント | なし（埋め込みは `https://codepen.io/ksyunnnn/embed/<id>`） |
| 認証 | — |
| 公式性 | — |
| レート制限 | — |
| 出典 | https://blog.codepen.io/docs/api/ |
| 件数 | — |
| 実測日 | 2026-09-02 |

公開 API が存在しない。公式ドキュメントに "We don't have a traditional API" と明記されている。加えて codepen.io 全体が Cloudflare の bot challenge を返し、**サーバからは oEmbed も pen のページも RSS も 403** になる。

**取得と埋め込みは別の経路である。** 埋め込みは閲覧者のブラウザが直接読む。題と URL は `src/data/manual-entries.ts` の `CODEPEN_PENS` が持つ。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | string | 手動 | `LYwzYEE` | 出所はブラウザで開いた一覧ページ |
| `title` | string | 手動 | フォーカスで表示・非表示 | 同上 |
| `url` | string | 手動 | `https://codepen.io/ksyunnnn/pen/LYwzYEE` | |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| すべて（サーバから） | Cloudflare の bot challenge が全経路を 403 にする | 実測 2026-09-02 |
| 公開日 | 上と同じ。登録日で並べる | 実測 2026-09-02 |
