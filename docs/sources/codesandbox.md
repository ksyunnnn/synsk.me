# CodeSandbox

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | HTML og:meta |
| エンドポイント | `https://codesandbox.io/embed/<id>` |
| 認証 | 不要 |
| 公式性 | **非公式**（メタデータ取得を目的とした経路ではない） |
| レート制限 | 未確認 |
| 出典 | https://codesandbox.io/docs |
| 件数 | 1 |
| 実測日 | 2026-09-02 |

公式 oEmbed（`https://codesandbox.io/oembed`）は Cloudflare の bot challenge で 403 を返す。200 で通るのは `/embed/<id>` だけで、そこから OG メタを読んでいる。

**存在しない ID でも 200 とサイト既定の OG が返る。** `og:title` が既定値かどうかで判定する。

掲載対象は `src/data/manual-entries.ts` の `CODESANDBOX_SANDBOXES` が持つ。ユーザー単位の列挙は 403。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `og:title` | string | 常時 | Zenn記事用 : useInputs / TypeScript - CodeSandbox | 既定値なら取り込まない |
| `og:description` | string | 常時 | `... by ksyunnnn using @emotion/css, ...` | 依存パッケージが読める |
| `og:image` | string | 取得不可 | — | 値は返るが指す先が 403 |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| サムネイル | `og:image` が指す `screenshot.png` が bot challenge で 403 | 実測 2026-09-02 |
| 公開日 | OG メタが日付を持たない。`manual-entries.ts` の登録日で並べる | 実測 2026-09-02 |
| ユーザーの一覧 | 列挙する経路が 403 | 実測 2026-09-02 |
