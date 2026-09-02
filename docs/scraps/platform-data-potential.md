# プラットフォームごとに使えるデータ（2026-09-02 実測）

> 書き捨て。消えても困らないものだけを置く。

12 プラットフォームについて、UI の形を決めずに「何が取れるか」を洗った記録。取得手段そのものは [external-api-verification.md](./external-api-verification.md) にある。

## Contents

- 使っていない有望なデータ
- プラットフォーム別
- 横断で結合できるキー
- 取れないと確定したもの
- 規約上の制約

---

## 使っていない有望なデータ

| # | 何が取れるか | どこから | 実測値 |
|---|---|---|---|
| 1 | CodePen の 2017〜2018 年分のソース全文 | GitHub Gist の `.markdown` に `A [Pen](https://codepen.io/ksyunnnn/pen/{id}) by …` の定型行がある | 16 件が pen ID を持ち、13 件が現存。3 件は CodePen 側で削除済みで Gist にしか残っていない |
| 2 | CodeSandbox の閲覧数・fork 数・全ファイルのソース | 埋め込みページに直書きされた `window.__SANDBOX_DATA__`（約 19KB、非公式） | `2u1kz` 15,789 views / `smolt0` 259 forks |
| 3 | 14 年分のコミット履歴 | `GET /search/commits?q=author:ksyunnnn`（未認証で動く） | 1,925 件、2016 年まで。2018=183 / 2024=681 / 2025=289 / 2026=503 |
| 4 | Speaker Deck の閲覧数とスライド枚数 | プロフィール HTML の `data-slide-count`。RSS にも oEmbed にも無い | 1,604 / 1,518 / 975 / 298。全 82 枚を個別画像で取得可能 |
| 5 | Qiita のいいねの時系列 | `GET /api/v2/items/{id}/likes`（未認証で 200） | 最人気記事は 2017 年に 76 件、最新のいいねが 2026-08-12 |
| 6 | Spotify の全収録曲 | 埋め込みページの `__NEXT_DATA__`（非公式） | 60 曲 / 222 分 / 37 アーティスト。カバー画像から抽出済みの配色 5 色つき |
| 7 | Medium の本文全文とカテゴリ | RSS の `content:encoded` と `category` | 22,418 文字・画像 28 枚。カテゴリ 11 種（life 8 / me 5 / work 4 / freelance / cebu / tokyo ほか） |

CodeSandbox の閲覧数は GitHub のスター最大 3 と桁が違う。スター数だけで代表作を選ぶと、最も読まれたものを取りこぼす。

---

## プラットフォーム別

### Zenn

- 記事 25 件。一覧 API に `topics` は入らず、**詳細 API だけ**が `topics`（33 種）・`body_html`（222,460 文字）・`toc`（見出し木 56 項目）・`og_image_url` を返す
- **スクラップ 30 件・本人コメント 148 件・34,967 文字**（2021-06〜2026-02）。他者コメントは 0 件で、全部が自分の作業記録。記事 4 プラットフォームが 2025-09-09 で止まる中、2026 年に更新があるのはここだけ。ただし量は年 1 件まで減っている
- 記事本文が外部リンクを持つ。これが横断結合の主経路になる

### Qiita

- 記事 77 件。`body` と `rendered_body` に全文
- `following_tags` 24 件、`followees` 39 件、**`stocks` 704 件**。いずれも未認証で取得可。Qiita 自身がストック一覧のページ題を `Public stock lists by ksyunnnn` としており公開情報。ただし「ストックした」であって「読んだ」ではない。ストック日時は返らず、順序だけが新しい順
- `page_views_count` は未認証では 77 件すべて null

### dev.to

- 公開記事は 1 件のみ。`reading_time_minutes` `tag_list` `positive_reactions_count` を持つ
- `canonical_url` は自分自身を指し、`crossposted_at` は null。**クロスポストは存在しない**ので、横断の重複排除は要らない

### Medium

- 10 件固定。本文 HTML 全文とカテゴリを持つ。4 プラットフォームで唯一、技術以外の語彙（life / work / freelance / cebu / tokyo）を持つ層
- 最新は 2021-01-03

### GitHub

- `created_at` 2016-07-26 が GitHub 歴の起点。公開リポジトリ 56 件、Gist 23 件
- **`events/public` は約 30 日・227 件しか遡れない**（実測）。長期履歴は `/search/commits` が唯一の REST 経路
- GraphQL に contributions カレンダー（日別の件数と 5 段階の濃さ）と `pinnedItems`（本人が選んだ代表作 5 件）。REST には無い
- 直近 1 年の contributions 2,153 のうち **1,521 は非公開リポジトリ分**。公開分だけなら 520。ポートフォリオにどちらを載せるかは判断が要る

### Speaker Deck

- 4 件。`description` に外部 URL を持つのは 3 件（connpass 1・デブサミ 1・IP 直打ち 1）
- presentation UUID が RSS・HTML・oEmbed・PDF・スライド画像の全経路を貫く主キー

### CodeSandbox

- 既知 4 件の外に 6 件、**計 10 件**。`/embed/github/ksyunnnn/{repo}` も 200 を返す
- `npm_dependencies` は 4 件とも `{react:16.0.0, react-dom:16.0.0}` を返し、実際の `package.json`（react 17.0.0 ほか）と矛盾する。**使ってはいけない**

### CodePen

- 総数およそ 180 件、2017-05〜2024-10。サーバ側は全経路 403
- `shots.codepen.io` はサーバ側から 200 が返り、**pen の生死を判定できる**（ブラウザ判定と 16/16 一致）。ただし User-Agent による許否の規則が不明

### connpass

- API キーは個人・コミュニティなら無償。**申請フォームの条件は「5 秒に 1 リクエスト」**で、OpenAPI が書く「1 秒 1 リクエスト」より厳しい。robots.txt の `Crawl-delay: 5` と一致する。審査は 5 営業日程度
- 申請フォームは、訪問者の操作でリアルタイムに API を呼ぶ構成を「承認できない場合がある」とし、API キーをブラウザや公開リポジトリに置くことを禁じている。ビルド時に取得して静的化する形はフォームの記入例と一致する
- `UserSchema` が `attended_event_count` / `organize_event_count` / `presenter_event_count` / `bookmark_event_count` と利用開始日時を **1 リクエストで**返す
- `EventSchema` に `lat` / `lon`。ジオコーディングなしで地図に置ける
- `events/{id}/presentations/` の `presentation_type` が `slide` / `movie` / `blog` に分かれる

### Spotify

- **2026 年の Dev Mode 変更で後退した。** `GET /v1/users/{id}/playlists` と `GET /v1/users/{id}` は削除済みで代替が無い。収録曲は所有・共同編集のプレイリストに限られ、Client Credentials では取れない。正規に取るには Authorization Code フローと、アプリ所有者の Premium 契約が要る。`audio-features` は deprecated
- 認証なしで取れるのは oEmbed（題とジャケット）と、埋め込みページの `__NEXT_DATA__`（非公式）。後者は 2 つのプレイリストで 29 曲と 31 曲を返し、ブラウザの User-Agent を要さない。1 曲あたり 12 フィールド（題・アーティスト・再生時間・explicit・30 秒プレビュー MP3 ほか）。**アルバム名・追加日・リリース年は含まれない**

### X

- **無料枠が存在しない。** 従量課金のみ（所有リソースの読み取り $0.001/件）
- oEmbed は別系統で認証なしに動く。個別投稿の指定に限られる。40 回連続および並列 15 本 × 30 リクエストで全件 200 になり、この規模では制限に当たらない。`cache_age` は 100 年
- 返るのは 10 フィールド。`html` から本文・表示名・ハンドル・日付・ハッシュタグが取れる。**取れないのは** `t.co` の展開後 URL、画像・動画、いいね/RT/返信数、正確な時刻
- 掲載対象は記事本文に埋め込まれた投稿から拾える。Zenn と Qiita の記事に本人の投稿が 5 件埋まっている

### TECHPLAY

- ユーザー単位の取得手段は無い。RSS はサイト全体の新着 1 本のみで、`?keyword=` を付けても内容が変わらない。robots.txt が全 UA に `Disallow: /user/*`

---

## 横断で結合できるキー

| キー | つなぐもの | 精度 |
|---|---|---|
| 記事本文の外部リンク | Zenn / Qiita → connpass・X・GitHub・CodeSandbox・CodePen | 最も確実。実データで確認済み |
| `github_username` = `ksyunnnn` | Zenn / Qiita / dev.to が同じ値を返す | 確実。表示名は 5 通りに割れており名前での突合は不可 |
| GitHub ユーザー ID `20659491` | GitHub ⇔ CodeSandbox（`author.avatar_url` が数値まで一致） | 確実 |
| リポジトリの `homepage` | GitHub ⇔ CodeSandbox（6 リポジトリが `codesandbox.io/s/github/ksyunnnn/{repo}`） | 1:1 で確定 |
| Gist の `.markdown` | GitHub ⇔ CodePen | 16 件、うち 13 件が現存 |
| 「Zenn記事用」の題 | CodeSandbox ⇔ Zenn 記事 | 3 件で確定（`2u1kz` `192u7` `26ghy`） |
| Speaker Deck の `description` | 登壇 ⇔ connpass イベント | **4 件中 1 件のみ**。日付でも裏が取れた（2019-09-13 = DIST.28） |

**逆方向は成立しない。** GitHub の `blog` は `syunsukekobashi.co` で synsk.me を指さず、`twitter_username` は null、プロフィール README も無い。56 リポジトリの name / description / homepage に zenn・dev.to は 0 件。結合は記事側から GitHub への一方向のみ。

connpass の `presentations` から Speaker Deck を引く経路も、確認した 2 イベントでは ksyunnnn の資料が登録されておらず成立しなかった。

---

## 取れないと確定したもの

- TECHPLAY のユーザー単位のデータ
- X の無料での一覧取得
- Spotify のユーザーのプレイリスト一覧（エンドポイントが削除済み）
- Medium の総記事数（フィード外のページが 403）
- CodePen のサーバ側からの一切の取得

---

## 規約上の制約

**connpass の `robots.txt` は全 UA に `Disallow: /`。** 明示的に許可されているのは `/*.ics` と `/*/ja.atom` の 2 つだけで、イベントページの HTML 取得は許可されていない。実装で使えるのは次に限る。

| 経路 | 状態 |
|---|---|
| `https://{subdomain}.connpass.com/ja.atom` | 200。グループの新着 10 件 |
| `https://connpass.com/event/{id}.ics` | 200。単一イベントの本文・会場・日時 |
| API キー経由の v2 API | キー取得後 |

`https://connpass.com/user/ksyunnnn/ja.atom` は 404 で、ユーザー単位の Atom は存在しない。ICS には `lat` / `lon` も参加者数も含まれないため、地図と活動量にはキーが要る。

**記事や登壇資料から抜いたイベント ID を `.ics` に渡す経路は、キーを取得する前に使える唯一の合法な経路である。**
