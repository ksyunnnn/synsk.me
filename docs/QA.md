# QA

> この文書は、アプリケーションと実装についてよく出る問いと答えを書く。

## 認証を、アプリケーションに Google 認証を組み DB で認可する構成（meatup 型）にしないのはなぜか

Cloudflare Access で認証する構成を採っている。決定と理由は [ADR-0013 認証をアプリケーションの外で行う](./decisions/0013-access-authentication.md) にある。

| | Cloudflare Access（採用） | meatup 型（アプリに Google 認証） |
|---|---|---|
| ログイン画面 | Cloudflare が出す。見た目は変えられない | 自分で作る |
| ログイン方法 | One-time PIN（メールで届くコード）。Google も足せる | Google |
| セッション・ログアウト | 作らない。Cloudflare が持つ | 作る。アプリが持つ |
| ログイン状態の画面への反映 | 作らない | 作る |
| 誰を通すかの置き場所 | Cloudflare の Access のポリシー `owner`（メールアドレス1件） | DB の認可の表 |
| 作り手のメールアドレスの置き場所（アプリ側） | Worker の secret `ACCESS_OWNER_EMAIL` | DB の認可の表 |
| ログインした人が誰かの置き場所 | 保存しない。リクエストごとに Access が JWT に入れて渡す | アプリのセッション |
| アプリが作り手を確かめる方法 | JWT を検証する。secret 3つ（`ACCESS_ISSUER`・`ACCESS_AUD`・`ACCESS_OWNER_EMAIL`）が要る | セッションを見て、DB の認可の表と照らす |
| Cloudflare 側の設定 | Access のアプリケーション2つとポリシー | なし |
| Google 側の設定 | なし（Google ログインを足すなら要る） | OAuth クライアント |
| 決定の記録 | ADR-0013 で採用 | ADR-0013 で検討し、採らなかった |

## ブランチの Preview は、PR ごとに別のデータベース（D1）を持つか

持たない。main 以外のブランチの Preview（ブランチを push したときにできる確認用の URL）は、すべてデータベース `synsk-me-preview`（Cloudflare の D1）を共有する。Cloudflare の Workers Previews は、D1 を Preview ごとに自動で作らない。Preview 全体で 1 つを共有する形を既定としている（[Resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)）。データを分けたいブランチだけ、専用の D1 に手で向け直す。

| | 本番 | Preview（既定） | Preview（専用の D1 に向け直したブランチ） |
|---|---|---|---|
| URL | `synsk.me` | `<ブランチ名>-synsk-me.is-syunsukekobashi.workers.dev` | 同左 |
| D1 | `synsk-me` | `synsk-me-preview`（全ブランチで共有） | そのブランチ専用 |
| secret の置き場所 | `npx wrangler secret put` | `npx wrangler preview base-config secret put` | 同左 |
| マイグレーション | 本番の D1 に手で当てる | 新しいマイグレーションを足したら、`synsk-me-preview` に手で 1 回当てる | 専用の D1 に手で当てる |

専用の D1 に向け直す手順:

1. `npx wrangler d1 create synsk-me-preview-<ブランチ名>` で D1 を作る
2. `wrangler.jsonc` の `previews.d1_databases` と、`wrangler.preview-migrations.jsonc` の `d1_databases` の `database_name` と `database_id` を、1 の値に書き換える
3. `npx wrangler d1 migrations apply synsk-me-preview-<ブランチ名> --remote --config wrangler.preview-migrations.jsonc` でマイグレーションを当てる
4. main にマージする前に 2 を元に戻し、`npx wrangler d1 delete` で D1 を消す
