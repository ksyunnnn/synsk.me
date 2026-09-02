# 外部プラットフォームの取得手段（2026-09-02 実測）

> 書き捨て。消えても困らないものだけを置く。

12 プラットフォームについて、公式ドキュメントと実リクエストの両方で取得可否を確定させた調査結果。実装は `src/lib/timeline/sources/` にある（TECHPLAY は取得手段が無いため実装を持たない）。

## Contents

- 再現の手順
- 様式
- Zenn
- Qiita
- dev.to
- Medium
- GitHub
- Speaker Deck
- CodeSandbox
- CodePen
- connpass
- Spotify
- X
- TECHPLAY

---

## 再現の手順

「経路」の値は、各節のエンドポイントへ実際に要求して得た HTTP ステータスと件数である。同じ URL を叩けば取り直せる。

```
curl -s -o /dev/null -w '%{http_code}\n' -A 'synsk.me (+https://synsk.me)' -L '<エンドポイント>'
```

dev.to だけは User-Agent を空にすると 403 を返す。この前提が生きているかは `-A ''` で確かめる。

## 様式

プラットフォームごとに「経路」「フィールド」「取れないもの」を持つ。経路が `なし` のときは「フィールド」を省く。

「取得」列は `常時` / `認証時のみ` / `手動` / `取得不可` の 4 値。前 3 者のうち `常時` `認証時のみ` `取得不可` は Singer の `inclusion`（`available` / `automatic` / `unsupported`）に対応する。`unsupported` は「the field exists in the source data but the tap is unable to provide it」と定義されており、認証が無いために埋まらないフィールドがこれにあたる。`手動` は Singer に対応する値を持たず、取得の経路が無く人が書き写した値を指す。

「状態」は `src/lib/timeline/types.ts` の `SourceStatus` と同じ値を使う。

出典: [Singer specification](https://github.com/singer-io/getting-started/blob/master/docs/DISCOVERY_MODE.md)

---

## Zenn

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | RSS |
| エンドポイント | `https://zenn.dev/ksyunnnn/feed` |
| 認証 | 不要 |
| 公式性 | 公式（Zenn 自身が配信するフィード） |
| レート制限 | 公式記載なし。レスポンスヘッダにも `rate-*` は無い |
| 出典 | [zenn-dev/zenn-community#496](https://github.com/zenn-dev/zenn-community/issues/496) |
| 件数 | 20 |
| 実測日 | 2026-09-02 |

公開 API は存在しない。Zenn 運営メンバーが上記 issue で「いいえ、公開しているAPIはありません」と回答している。`https://zenn.dev/api/articles?username=ksyunnnn` は 200 を返し全 25 件を返すが、非公式の経路である。

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | オプションを渡しても渡さなくても動く関数 | |
| `link` | string | 常時 | `https://zenn.dev/ksyunnnn/articles/095c1dea25e31f` | |
| `guid` | string | 常時 | `link` と同値 | `isPermaLink="true"` |
| `pubDate` | string | 常時 | `Tue, 09 Sep 2025 08:02:10 GMT` | RFC822 |
| `description` | string | 常時 | 本文冒頭のプレーンテキスト | |
| `enclosure@url` | string | 常時 | Cloudinary 生成の OG 画像 1200x630 | タイトル文字が焼き込まれている |
| `dc:creator` | string | 常時 | こばしゅん | |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| タグ | RSS に含まれない。詳細 API のみが `topics` を返す | 実測 2026-09-02 |
| いいね数 | RSS に含まれない | 実測 2026-09-02 |
| 21 件目以降 | RSS は 20 件固定 | 実測 2026-09-02 |

---

## Qiita

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | REST |
| エンドポイント | `https://qiita.com/api/v2/users/ksyunnnn/items?per_page=10` |
| 認証 | 任意（`QIITA_ACCESS_TOKEN`） |
| 公式性 | 公式 |
| レート制限 | 未認証 60 req/h/IP、認証 1,000 req/h |
| 出典 | https://qiita.com/api/v2/docs |
| 件数 | 10（`per_page=10` のため。総数は `total-count` が 77） |
| 実測日 | 2026-09-02 |

`per_page` は 1〜100、`page` は 1〜100。総数はレスポンスヘッダ `total-count` で取れる。

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | string | 常時 | `d5af0c1e2e3b8722c868` | |
| `title` | string | 常時 | VSCode ESLintとPrettierを保存時に自動整形する設定メモ | |
| `url` | string | 常時 | `https://qiita.com/ksyunnnn/items/d5af0c1e2e3b8722c868` | |
| `created_at` | string | 常時 | `2022-05-19T10:20:46+09:00` | 公開日はこれを使う。専用フィールドは無い |
| `likes_count` | number | 常時 | `2` | |
| `stocks_count` | number | 常時 | `2` | |
| `tags[].name` | string | 常時 | `ESLint` `VSCode` `prettier` | |
| `body` | string | 常時 | Markdown 全文 | レスポンスが 214KB になる主因 |
| `rendered_body` | string | 常時 | HTML 全文 | 同上 |
| `page_views_count` | number \| null | 認証時のみ | `null` | 未認証では 77 件すべて null |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| サムネイル | API にフィールドが存在しない | 実測 2026-09-02 |

---

## dev.to

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | REST |
| エンドポイント | `https://dev.to/api/articles?username=ksyunnnn&per_page=10` |
| 認証 | 不要 |
| 公式性 | 公式（Forem API v1） |
| レート制限 | 読み取りの記載なし。書き込みのみ記載がある |
| 出典 | https://developers.forem.com/api/v1 |
| 件数 | 1 |
| 実測日 | 2026-09-02 |

**User-Agent が必須。** 空の User-Agent では 403 を返す。Cloudflare Workers の `fetch` は既定の User-Agent を付けないため、明示する。

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | number | 常時 | `1715490` | |
| `title` | string | 常時 | How to use Supabase CLI & Local Dev | |
| `description` | string | 常時 | this is a memo for personal reference | |
| `url` | string | 常時 | `https://dev.to/ksyunnnn/how-to-use-supabase-cli-local-dev-5bic` | |
| `published_at` | string | 常時 | `2024-01-03T05:48:34Z` | ISO 8601 UTC |
| `public_reactions_count` | number | 常時 | `7` | `positive_reactions_count` も同値で返る |
| `social_image` | string | 常時 | `https://media2.dev.to/dynamic/image/...` | 1000x500 |
| `cover_image` | string \| null | 常時 | `null` | |
| `tag_list` | string[] | 常時 | `["supabase","docker"]` | |
| `reading_time_minutes` | number | 常時 | — | |
| `canonical_url` | string | 常時 | 自分自身を指す | クロスポストではない |
| `crossposted_at` | null | 常時 | `null` | 同上 |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| 本文 | 一覧エンドポイントには含まれない | 実測 2026-09-02 |

---

## Medium

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | RSS |
| エンドポイント | `https://medium.com/feed/@ksyunnnn` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 公式記載なし。`cache-control: private, must-revalidate, max-age=900` |
| 出典 | [Medium/medium-api-docs](https://github.com/Medium/medium-api-docs) |
| 件数 | 10 |
| 実測日 | 2026-09-02 |

API は提供終了している。上記リポジトリの README に "The Medium API is no longer supported." と明記され、2023-03-02 にアーカイブ済み。

### フィールド

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

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| いいね数・レスポンス数 | RSS に含まれない | 実測 2026-09-02 |
| 11 件目以降 | 10 件固定でページングの手段が無い | 実測 2026-09-02 |
| 総記事数 | プロフィールと記事ページが 403 | 実測 2026-09-02 |

---

## GitHub

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | REST |
| エンドポイント | `https://api.github.com/users/ksyunnnn/repos?sort=pushed&per_page=30` |
| 認証 | 任意（`GITHUB_TOKEN`） |
| 公式性 | 公式 |
| レート制限 | 未認証 60 req/h/IP、PAT 5,000 req/h |
| 出典 | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| 件数 | 30（`per_page=30` のため。公開リポジトリは 56 件） |
| 実測日 | 2026-09-02 |

Cloudflare Workers は共有 IP から出るため、未認証の 60 req/h は他のテナントと分け合う。

OpenAPI の記述を GitHub 自身が [github/rest-api-description](https://github.com/github/rest-api-description) で公開している（MIT）。

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | number | 常時 | — | |
| `name` | string | 常時 | `synsk.me` | |
| `full_name` | string | 常時 | `ksyunnnn/synsk.me` | OG 画像の URL を組み立てるのに使う |
| `description` | string \| null | 常時 | `null` | |
| `html_url` | string | 常時 | `https://github.com/ksyunnnn/synsk.me` | |
| `language` | string \| null | 常時 | `Shell` | |
| `topics` | string[] | 常時 | `[]` | 追加ヘッダなしで返る |
| `stargazers_count` | number | 常時 | `0` | 最大は 3（KeepBoard） |
| `forks_count` | number | 常時 | `0` | |
| `archived` | boolean | 常時 | `false` | 除外に使う |
| `fork` | boolean | 常時 | `false` | 除外に使う |
| `pushed_at` | string \| null | 常時 | `2026-09-01T15:08:13Z` | **コミットが 1 つも無いと `null`。`new Date(null)` は 1970 になる** |
| `created_at` | string | 常時 | `2022-11-26T...` | `pushed_at` が null のときの代替 |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| サムネイル（公式経路） | REST API にフィールドが無い | 実測 2026-09-02 |
| 30 日より前の活動 | `/users/ksyunnnn/events/public` が 227 件・約 30 日で尽きる。長期は `/search/commits`（1,925 件・2016 年まで） | 実測 2026-09-02 |
| contributions カレンダー | REST に存在しない。GraphQL のみ | 実測 2026-09-02 |

`https://opengraph.githubassets.com/1/{full_name}` は OG 画像を返すが、**ドキュメントに無い経路であり、続けて叩くと 429 を返す。** 落ちたものは表示側でプラットフォームのグリフに落ちる。

---

## Speaker Deck

### 経路

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

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | ひとりで Atomic Workflow を試してみた | |
| `link` | string | 常時 | `https://speakerdeck.com/ksyunnnn/hitoride-atomic-workflow-woshi-sitemita` | 末尾スラッシュ・クエリ無し |
| `guid` | string | 常時 | `link` と同値 | |
| `pubDate` | string | 常時 | `Fri, 13 Sep 2019 00:00:00 -0400` | オフセットが `-0400` |
| `description` | string | 常時 | `https://dist.connpass.com/event/144496/` | 4 件中 3 件に外部 URL、1 件は「ざっくり」 |
| `media:content@url` | string | 常時 | 1 枚目スライドの JPEG | キャッシュバスター付き |
| oEmbed `html` | string | 常時 | player の iframe | `src` から埋め込み URL を取る |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| 閲覧数 | RSS にも oEmbed にも無い。プロフィール HTML にのみ存在する | 実測 2026-09-02 |
| スライド枚数 | 同上（`data-slide-count`） | 実測 2026-09-02 |

---

## CodeSandbox

### 経路

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

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `og:title` | string | 常時 | Zenn記事用 : useInputs / TypeScript - CodeSandbox | 既定値なら取り込まない |
| `og:description` | string | 常時 | `... by ksyunnnn using @emotion/css, ...` | 依存パッケージが読める |
| `og:image` | string | 取得不可 | — | 値は返るが指す先が 403 |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| サムネイル | `og:image` が指す `screenshot.png` が bot challenge で 403 | 実測 2026-09-02 |
| 公開日 | OG メタが日付を持たない。`manual-entries.ts` の登録日で並べる | 実測 2026-09-02 |
| ユーザーの一覧 | 列挙する経路が 403 | 実測 2026-09-02 |

---

## CodePen

### 経路

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

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `id` | string | 手動 | `LYwzYEE` | 出所はブラウザで開いた一覧ページ |
| `title` | string | 手動 | フォーカスで表示・非表示 | 同上 |
| `url` | string | 手動 | `https://codepen.io/ksyunnnn/pen/LYwzYEE` | |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| すべて（サーバから） | Cloudflare の bot challenge が全経路を 403 にする | 実測 2026-09-02 |
| 公開日 | 上と同じ。登録日で並べる | 実測 2026-09-02 |

---

## connpass

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `unconfigured` |
| 経路 | REST |
| エンドポイント | `https://connpass.com/api/v2/users/ksyunnnn/attended_events/` |
| 認証 | 必須（`CONNPASS_API_KEY`、ヘッダ名 `X-API-Key`） |
| 公式性 | 公式 |
| レート制限 | **5 秒に 1 リクエスト**（申請フォームの条件。OpenAPI が書く「1 秒 1 リクエスト」より厳しい） |
| 出典 | https://connpass.com/about/api/v2/ |
| 件数 | — |
| 実測日 | 2026-09-02 |

v1 は廃止済みで 403 を返す。公式 OpenAPI 3.1.0 が `https://connpass.com/about/api/v2/openapi.json` にあり、7 paths / 16 schemas / `APIKeyAuth` を定義している。

**キーは個人・コミュニティなら無償。** 審査は 5 営業日程度。訪問者の操作でリアルタイムに API を呼ぶ構成は承認されない場合があり、キーをブラウザや公開リポジトリに置くことは禁じられている。ビルド時に取得して静的化する形は、フォームの記入例と一致する。

### フィールド

API キーが無いため実データを持たない。型と必須の別は公式 OpenAPI の `EventListResponseSchema` による。

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `results_returned` | number | 認証時のみ | — | 必須 |
| `results_available` | number | 認証時のみ | — | 必須。総件数 |
| `results_start` | number | 認証時のみ | — | 必須 |
| `events` | Event[] | 認証時のみ | — | **必須**（任意ではない） |
| `events[].title` | string | 認証時のみ | — | |
| `events[].started_at` | string | 認証時のみ | — | |
| `events[].accepted` | number | 認証時のみ | — | |
| `events[].lat` / `lon` | number | 認証時のみ | — | 地図に置ける |
| `events[].hash_tag` | string | 認証時のみ | — | |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| キーなしでのすべて | 全エンドポイントで API キーが必須 | 実測 2026-09-02（401） |
| イベントページの HTML | `robots.txt` が全 UA に `Disallow: /`。許可は `/*.ics` と `/*/ja.atom` のみ | https://connpass.com/robots.txt |
| ユーザー単位の Atom | `/user/ksyunnnn/ja.atom` が 404 | 実測 2026-09-02 |

記事や登壇資料から抜いたイベント ID を `https://connpass.com/event/{id}.ics` に渡す経路は、キーを取得する前に使える唯一の合法な経路である。

---

## Spotify

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | oEmbed |
| エンドポイント | `https://open.spotify.com/oembed?url=` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 公式記載なし |
| 出典 | https://developer.spotify.com/documentation/embeds |
| 件数 | 1 |
| 実測日 | 2026-09-02 |

個別プレイリストの指定に限られる。掲載対象は `src/data/manual-entries.ts` の `SPOTIFY_PLAYLISTS` が持つ。

Web API の `GET /v1/users/{id}/playlists` と `GET /v1/users/{id}` は **2026 年の変更で削除され、代替が無い**。収録曲は所有・共同編集のプレイリストに限られ、Client Credentials では取れない。正規に取るには Authorization Code フローとアプリ所有者の Premium 契約が要る。

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | ゆるくてやさしい🧃 | |
| `thumbnail_url` | string | 常時 | `https://mosaic.scdn.co/300/...` | 300x300。収録曲が変わると URL も変わる |
| `iframe_url` | string | 常時 | `https://open.spotify.com/embed/playlist/...` | 埋め込みに使う |
| `html` | string | 常時 | iframe のマークアップ | `iframe_url` があれば不要 |
| `width` / `height` | number | 常時 | `456` / `352` | |

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| プレイリストの一覧 | エンドポイントが削除された | https://developer.spotify.com/documentation/web-api |
| 曲数・説明文・所有者名 | oEmbed に含まれない | 実測 2026-09-02 |
| 公開日 | oEmbed が日付を持たない。登録日で並べる | 実測 2026-09-02 |

---

## X

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | oEmbed |
| エンドポイント | `https://publish.x.com/oembed?url=` |
| 認証 | 不要 |
| 公式性 | 公式 |
| レート制限 | 40 回連続・並列 15 本 × 30 リクエストで全件 200。この規模では当たらない |
| 出典 | https://docs.x.com/x-api/getting-started/pricing |
| 件数 | 1 |
| 実測日 | 2026-09-02 |

X API v2 に**無料枠は存在しない**。従量課金のみで、所有リソースの読み取りが $0.001/件。認証なしで使えるのは個別投稿を指定する oEmbed だけ。

掲載対象は `src/data/manual-entries.ts` の `X_POSTS` が持つ。8 件はいずれも Zenn と Qiita の記事本文に埋め込まれた投稿で、oEmbed の `author_name` が本人を返し、投稿日も同じレスポンスから読める。

### フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `html` | string | 常時 | blockquote のマークアップ | 本文・表示名・ハンドル・日付が読める |
| `author_name` | string | 常時 | こばしゅん | 本人確認に使った |
| `author_url` | string | 常時 | `https://twitter.com/ksyunnnn` | |
| `url` | string | 常時 | 正規化された投稿 URL | |
| `cache_age` | string | 常時 | 100 年相当 | |
| `height` | null | 常時 | `null` | 常に null。実高さは埋め込みが postMessage で通知する |

`html` は画像も引用も含まない。`https://platform.twitter.com/embed/Tweet.html?id=<id>` は含む。画像付きは画像を、引用は引用元を入れ子で持ち、**外部リンクはカードにならずリンクのテキストのまま**になる。

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| 投稿の一覧 | 無料枠が無い | https://docs.x.com/x-api/getting-started/pricing |
| いいね数・RT 数 | oEmbed に含まれない | 実測 2026-09-02 |
| `t.co` の展開後 URL | oEmbed が展開しない | 実測 2026-09-02 |

---

## TECHPLAY

### 経路

| 項目 | 値 |
|---|---|
| 状態 | `unavailable` |
| 経路 | なし |
| エンドポイント | — |
| 認証 | — |
| 公式性 | — |
| レート制限 | — |
| 出典 | https://techplay.jp/robots.txt |
| 件数 | — |
| 実測日 | 2026-09-02 |

公開 API もユーザー単位のフィードも存在しない。提供されているのはサイト全体の新着イベント RSS `https://rss.techplay.jp/event/w3c-rss-format/rss.xml` の 1 本のみで、`?keyword=` を付けてもレスポンスが 1 バイトも変わらない。`robots.txt` は全 UA に `Disallow: /user/*` を課している。

### 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| ユーザー単位のすべて | API もフィードも存在せず、ユーザーページが 404 | 実測 2026-09-02 |
| 全体 RSS の絞り込み | `?keyword=` が無効 | 実測 2026-09-02 |

記事本文には techplay.jp と前身の eventdots.jp への URL が 14 件ある。主催コミュニティは `MoquMoquCOM`。connpass だけでは 2017 年の主催歴が欠ける。
