# Medium

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | RSS |
| エンドポイント | `https://medium.com/feed/@ksyunnnn` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 公式記載なし。`cache-control: private, must-revalidate, max-age=900` |
| 出典 | [Medium/medium-api-docs](https://github.com/Medium/medium-api-docs) |
| 実測日 | 2026-09-02（10 件） |

API は提供終了している。上記リポジトリの README に "The Medium API is no longer supported." と明記され、2023-03-02 にアーカイブ済み。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | 2021年の挨拶と2020年の振り返り | |
| `link` | string | 常時 | `https://medium.com/syunsukekobashi/...?source=rss-...` | クエリを除いて使う |
| `guid` | string | 常時 | `https://medium.com/p/55fef51df50c` | `isPermaLink="false"` |
| `pubDate` | string | 常時 | `Sun, 03 Jan 2021 12:13:20 GMT` | RFC822 |
| `category` | string[] | 常時 | `me` `life` `work` `freelance` `cebu` `tokyo` ほか全 11 種 | |
| `content:encoded` | string | 常時 | 記事 HTML 全文（22,418 文字・画像 28 枚） | レスポンス 87KB の主因 |
| `dc:creator` | string | 常時 | Syunsuke Kobashi/小橋 俊介 | |

サムネイルは専用フィールドを持たない。`content:encoded` の先頭の `<img>` から取る。

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| いいね数・レスポンス数 | RSS に含まれない | 実測 2026-09-02 |
| 11 件目以降 | 10 件固定でページングの手段が無い | 実測 2026-09-02 |
| 総記事数 | プロフィールと記事ページが 403 | 実測 2026-09-02 |
