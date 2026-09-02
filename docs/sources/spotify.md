# Spotify

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | oEmbed |
| エンドポイント | `https://open.spotify.com/oembed?url=` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 公式記載なし |
| 出典 | https://developer.spotify.com/documentation/embeds |
| 実測日 | 2026-09-02（掲載 2 件） |

個別プレイリストの指定に限られる。掲載対象は `src/data/manual-entries.ts` の `SPOTIFY_PLAYLISTS` で指名する。

Web API の `GET /v1/users/{id}/playlists` と `GET /v1/users/{id}` は **2026 年の変更で削除され、代替が無い**。収録曲は所有・共同編集のプレイリストに限られ、Client Credentials では取れない。正規に取るには Authorization Code フローとアプリ所有者の Premium 契約が要る。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | ゆるくてやさしい🧃 | |
| `thumbnail_url` | string | 常時 | `https://mosaic.scdn.co/300/...` | 300x300。収録曲が変わると URL も変わる |
| `iframe_url` | string | 常時 | `https://open.spotify.com/embed/playlist/...` | 埋め込みに使う |
| `html` | string | 常時 | iframe のマークアップ | `iframe_url` があれば不要 |
| `width` / `height` | number | 常時 | `456` / `352` | |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| プレイリストの一覧 | エンドポイントが削除された | https://developer.spotify.com/documentation/web-api |
| 曲数・説明文・所有者名 | oEmbed に含まれない | 実測 2026-09-02 |
| 公開日 | oEmbed が日付を持たない。登録日で並べる | 実測 2026-09-02 |
