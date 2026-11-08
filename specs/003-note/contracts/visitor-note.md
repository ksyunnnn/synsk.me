# Contract: note のページ（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /notes/{slug}`、公開で削除していない note がある | 200。下の DTO の値だけで描画する |
| `GET /notes/{slug}`、note が無い・下書き・削除した | 404。`src/proxy.ts` が描画の前に `/notes/{slug}/missing` へ rewrite する（research.md の R12） |
| `GET /notes/{slug}/images/{file}`、公開で削除していない note の、公開した版の本文が `media:{file}` を含む画像か、代表画像 | 200。R2 の物を `Cache-Control: no-store` で返す |
| `GET /notes/{slug}/images/{file}`、上のどれにも当たらない | 404 |
| `GET /notes/{slug}/card-image`、公開で削除していない note | 200。題を入れた 1200×630 の PNG |
| `GET /notes/{slug}/card-image`、それ以外 | 404 |

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。

## DTO

Repository の実装は、`status = 'published' AND deleted_at IS NULL` の note の、`published_revision_id` の版の列だけを読む。最新の版・下書きの版・削除した note の列を読まない（FR-012・SC-001）。画面・`<title>`・OGP・RSC の応答は、この形の値だけを使う。

| 項目 | 元の列 |
|---|---|
| `slug` | `note.slug` |
| `title` | 公開した版の `note_revision.title` |
| `description` | 公開した版の `note_revision.description`（空あり） |
| `body` | 公開した版の `note_revision.body` |
| `publishedAt` | `note.published_at`（初めて公開した日時） |
| `cardImage` | `note.card_image` と、`media` のときは `card_media_id` の画像のファイル名 |
| `linkPreviews` | 公開した版の本文のカードにする URL の、`link_preview` の題と画像の URL（取れた URL だけ） |

`og:description` は `description`、空なら本文の冒頭（docs/CRAWLING.md）。

## 検査

- 結合: 下書き・削除した note の `/notes/{slug}` が 404 で、その note の題・本文が HTML と RSC の応答に含まれない（SC-001）
- 結合: 公開した後に保存した版の題・本文が、公開し直すまで応答に含まれない（FR-012）
- 結合: 下書きの note の画像、公開した版が指さない画像が 404（FR-026）
- 結合: カードにする URL を持つ note を表示しても、参照先へ取りに行かない（SC-005。`link_preview` の行を描くだけで、fetch を呼ばない）
- 単体: `src/proxy.ts` が無い識別子を `/notes/{slug}/missing` へ rewrite する
