# Contract: note のページ（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /notes/{slug}`、公開で削除していない note がある | 200。下の DTO の値だけで描画する |
| `GET /notes/{slug}`、note が無い・下書き・下書きに戻した・削除した | 404。`src/proxy.ts` が描画の前に `/notes/{slug}/missing` へ rewrite する。中身を応答に含めない。削除した note の応答を別にするかは plan.md の U10 |
| `GET /notes/{slug}`、D1 から読めない | proxy は判定せずに通し、ページが 500 の画面を返す |
| `GET /notes/{slug}/media/{key}`、公開で削除していない note の、公開した版の本文が指す画像か代表画像 | 200。R2 の原本を変換せずに返す（research.md の R12） |
| `GET /notes/{slug}/media/{key}`、それ以外（下書き・削除した note の画像、公開した後に保存した版にだけ置いた画像、別の note の画像、無い key） | 404。中身を返さず、`Cache-Control: no-store` を付ける（FR-026） |

経路の形 `/notes/{slug}` は ADR-0048 から導いた。オーナーの確認は plan.md の U2。

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない（research.md の R9）。

## DTO

Repository の実装は `note.status = 'published' AND note.deleted_at IS NULL` の行だけを読み、`note.published_revision_id` の版を詰める。最も新しい版は読まない。画面・`<title>`・OGP・RSC の応答は、この形の値だけを使う。

| 項目 | 元の列 |
|---|---|
| `slug` | `note.slug` |
| `title` | 公開した版の `note_revision.title` |
| `description` | 公開した版の `note_revision.description`（空あり） |
| `body` | 公開した版の `note_revision.body`。共有担当の Markdown の部品で描き、生の HTML を通さない（research.md の R11） |
| `publishedAt` | `note.published_at`（初めて公開した日時、FR-013） |
| `cardImage` | `note.card_image` と、`media` のときは `note.card_media_id` の画像。`generated` の画像は plan.md の U8、`media` の画像は `/notes/{slug}/media/{key}`。`site` はサイト共通の画像 |
| `media` | 公開した版の本文が指す画像のうち、その note の `media` の行にある `storage_key` の並び。画像の `src` はこの並びにある値だけから作る（research.md の R11・R12） |
| `linkPreviews` | 公開した版の本文の URL が指す `link_preview` の `url`・`title`・`image_url`。カードにするのは行に URL だけを書いた行（research.md の R11）。出し方は U9 が解けてから |

DTO が持たないもの: `note.uid`・`note.id`・最も新しい版と公開した後に保存した版・`deleted_at`・`syndication.url`（訪問者に見せるかは plan.md の U11）。

## OGP

`docs/CRAWLING.md` の「リンクが貼られたときの見え方」に従う。題は `title`、説明は `description`。`description` が空なら、本文の最初の段落の文字列を出す（research.md の R11）。画像は `cardImage`。

## 検査

- 結合: 本文に書いた `<script>` などの HTML が、応答の中で HTML の要素にならない（U4 の決定）
- 結合: 下書き・下書きに戻した・削除した note の `/notes/{slug}` が 404 で、HTML と RSC の応答に題・説明文・本文が含まれない（SC-001、User Story 1 の 1、User Story 2 の 1・3）
- 結合: 公開した後に保存して公開し直していない版の題・説明文・本文が、`/notes/{slug}` の応答に含まれない（FR-012・SC-001）
- 結合: 公開し直した後、同じ URL で直した本文が出て、`publishedAt` が変わらない（User Story 1 の 5、SC-004）
- 結合: 公開した版の本文に無く代表画像でもない画像、下書きと削除した note の画像の経路が中身を返さず `no-store` を持つ（FR-026・SC-001、User Story 5 の 4・5）
- 結合: URL カードを含む note の表示で、参照先への取得が 0 回（SC-005）。参照先への `fetch` を検査の中で数える
