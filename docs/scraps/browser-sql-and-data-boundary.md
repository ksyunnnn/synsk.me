# ブラウザで SQL を動かす案と、公開境界の引き方

> 書き捨て。消えても困らないものだけを置く。

2026-08-26 の検討で理解したこと。問いの形で残す。

---

## Contents

- Q. 非公開データはどう守るのが一般的か
- Q. 「迂回」とは何か
- Q. 迂回できると危ないのか
- Q. DuckDB WASM は何と組み合わせるのか
- Q. SQLite の WASM でも同じことができるか
- Q. 抽出物を置くと何が失われるか
- 結論

---

## Q. 非公開データはどう守るのが一般的か

**出力する層で、出す項目を明示する。** フレームワークを問わず同じ結論だった。

| 出典 | 呼び名 | 中身 |
|---|---|---|
| [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html) | Allow-listing / DTO | 出す項目を列挙する |
| [Django REST Framework](https://www.django-rest-framework.org/api-guide/serializers/) | Serializer の `fields` | 明示必須。`exclude` は非推奨 |
| [Laravel](https://laravel.com/docs/12.x/eloquent-resources) | API Resource | 変換層を挟み、条件で項目を落とす |
| [Next.js](https://nextjs.org/docs/app/guides/authentication) | DAL + DTO | 必要なカラムだけ返す |

DRF の記述。

> It is strongly recommended that you explicitly set all fields that should be serialized using the `fields` attribute. This will make it less likely to result in unintentionally exposing data when your models change.

これは [ADR-0008](../decisions/0008-content-visibility.md) が Risks に書いた「許可リスト方式（これだけを出す）であれば、新しいカラムは既定で公開されない」と同じことを言っている。

---

## Q. 「迂回」とは何か

**自分が書いたコードを通らずに DB へ届く経路があるか。**

Supabase と Firebase は、ブラウザから DB を直接叩けるように作られている。変換層を丁寧に書いても、その経路は別の入口なので通らない。だから DB 側のルール（RLS / `firestore.rules`）で塞ぐ必要がある。

Supabase の記述。

> A table in an exposed schema without RLS is readable and writable by any role with a grant on it.

`meatup` で踏んだ穴がこれだった（[meatup-zenn-article-notes.md](./meatup-zenn-article-notes.md)）。招待トークンの使い切りをクライアントの transaction だけに頼っていたら、SDK を介さない直接書き込みですり抜けた。

---

## Q. 迂回できると危ないのか

**危ないのではなく、守る場所が2つになる。**

| 型 | 守る場所 | 代表 |
|---|---|---|
| サーバ経由のみ | 変換層だけ | Cloudflare D1 / Turso / Neon / AWS RDS / GCP Cloud SQL |
| クライアント直叩きも開く | 変換層 + DB のルール | Supabase / Firebase |

後者は多層防御としては厚い。変換層のミスを DB 側が止めるため。代わりにルールを書き忘れると既定で開いている。

クライアント直叩き型は、バックエンドを書かずに済ませるための設計。管理画面をサーバ経由にすると、この利点は活きない。

---

## Q. DuckDB WASM は何と組み合わせるのか

**DB ではなくオブジェクトストレージ。**

[DuckDB WASM の公式](https://duckdb.org/docs/current/clients/wasm/overview.html)は、読める対象を Parquet / CSV / JSON / Arrow とし、ローカル・HTTP・メモリを同じ仮想ファイルシステムで扱うとしている。範囲読みもできる。

> JavaScript httpfs implementation fetches only the required byte ranges

つまり構成はこうなる。

```
正本の DB
  ↓ 公開分だけ抽出してファイルを書き出す
オブジェクトストレージ（R2 など）
  ↓ HTTP 範囲読み
ブラウザの DuckDB WASM
```

**DB を何にするかは相性にほぼ関係しない。** どれからでも書き出せる。効くのは置き場所で、Cloudflare R2 は egress 無料なので有利。Neon は egress 5GB/月なので当たりうる。

---

## Q. SQLite の WASM でも同じことができるか

できる。[SQLite 公式の WASM ビルド](https://sqlite.org/wasm/doc/trunk/index.md)があり、HTTP 越しの読み取りも用意されている。

> sqlite-wasm-http, which provides an SQLite VFS with read-only access to databases which are served directly over HTTP

正本を SQLite にすると抽出物も SQLite になり、扱う形式が1つ減る。Parquet は列指向で集計に速いが、数百件規模では差が出にくい。

Turso の embedded replica はブラウザでは動かない。ファイルシステムが要るため。

---

## Q. 抽出物を置くと何が失われるか

**形式を問わず、ブラウザに渡すものは「公開分だけを抽出したファイル」になる。** 正本をそのまま配ると非公開データが届くため。ここは避けられない。

| 失われるもの | 内容 |
|---|---|
| 即時反映 | 抽出物を作り直すまで古いまま |
| 一貫性 | 記事は最新、探索は抽出時点。同じサイトに2つの時点が並ぶ |
| 正本が1つという状態 | 同じデータが2箇所に存在する |
| 削除の即時性 | [FR-11](../REQUIREMENTS.md) — DB から消しても抽出物に残る |
| 非公開への切り替えの即時性 | [FR-06](../REQUIREMENTS.md) — 同上 |

最後の2つは [ADR-0008](../decisions/0008-content-visibility.md) の動機（センシティブな情報が見つかったとき、削除以外の方法が要る）に直接ぶつかる。

抽出物は URL が分かれば誰でも取得できる。中身は公開データだけなので漏洩ではないが、サイトの全データが1ファイルで持ち出せる状態にはなる。

---

## 結論

2026-08-26 時点で横断的な探索は機能のスコープに入っていないため、ブラウザで SQL を動かす案は採らない。

採るとしたら、探索機能を要件に入れてからになる。そのとき決めるのは「Parquet か SQLite か」ではなく、**抽出物をいつ作り直すか**。非公開への切り替えと削除に追随できないと [ADR-0008](../decisions/0008-content-visibility.md) と衝突する。
