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
