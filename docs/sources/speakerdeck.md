# Speaker Deck

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | RSS（一覧）、oEmbed（埋め込み URL） |
| エンドポイント | `https://speakerdeck.com/ksyunnnn.rss` / `https://speakerdeck.com/oembed.json?url=` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 公式記載なし。レスポンスヘッダにも `x-ratelimit-*` は無い |
| 出典 | https://speakerdeck.com/faq |
| 件数 | 4 |
| 実測日 | 2026-09-02 |

REST API は存在しない。公式 FAQ が案内するのは oEmbed のみで、これは個別デッキの指定に限られる。一覧は RSS から取る。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | ひとりで Atomic Workflow を試してみた | |
| `link` | string | 常時 | `https://speakerdeck.com/ksyunnnn/hitoride-atomic-workflow-woshi-sitemita` | 末尾スラッシュ・クエリ無し |
| `guid` | string | 常時 | `link` と同値 | |
| `pubDate` | string | 常時 | `Fri, 13 Sep 2019 00:00:00 -0400` | オフセットが `-0400` |
| `description` | string | 常時 | `https://dist.connpass.com/event/144496/` | 4 件中 3 件に外部 URL、1 件は「ざっくり」 |
| `media:content@url` | string | 常時 | 1 枚目スライドの JPEG | キャッシュバスター付き |
| oEmbed `html` | string | 常時 | player の iframe | `src` から埋め込み URL を取る |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| 閲覧数 | RSS にも oEmbed にも無い。プロフィール HTML にのみ存在する | 実測 2026-09-02 |
| スライド枚数 | 同上（`data-slide-count`） | 実測 2026-09-02 |
