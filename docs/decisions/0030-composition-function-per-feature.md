---
status: accepted
date: 2026-09-14
decision-makers: synsk
consulted: Claude
---

# 機能ごとに組み立て用の関数を 1 か所に作り、画面はそれを呼ぶ

## Context and Problem Statement

synsk.me のコードは、層の分け方と依存のルールを nrs（成瀬 允宣）の ADOP（Application Domain Others Pattern）に従う。2026-09-14 にそう判断した。`features/<名前>/` の中で、`application/` はユースケースを持ち、`server/` はリポジトリの D1 での実装を持つ。

ADOP のルール 2 は `上位レイヤーのオブジェクトが下位レイヤーのオブジェクトを取り扱うときには汎化すること` である。ここから、`application/` は `components/` と `server/` を直接 import せず、使うときはインタフェースを介する。データを取り出す係（リポジトリの実装）を誰が `application/` に渡すかが問題になる。ADOP の例は IoC Container を使う。

[ADR-0026](./0026-code-structure-adop.md) の依存の向きの規則 3 は、`'use client'` のファイルは `server/` を import せず、`server/` を呼ぶのは `page.tsx`・`layout.tsx` と Server Component とする。

2026-09-14 の対話で判断した。判断に使った事実は次のとおり。

- ADOP: `どの実装クラスを利用するかといったことを一箇所で管理できます。` / `WEB アプリケーションをデータベースに接続せず、疑似的に動作させてテストするのに役に立ちます。` / IoC Container は `利用すると便利です` とあり、必須ではない
- Next.js の認証ガイド: `Run verifySession(), getUser(), or similar in a parent Server Component`（訳: 親の Server Component で `verifySession()` や `getUser()` などを実行する。2026-08-25）。公式の例 `examples/with-iron-session-cache-components`（2026-08-07）も、`import "server-only";` で始まる `lib/data.ts` の関数を画面から呼ぶ
- React: `Server Components can also run on a web server during a request for a page, letting you access your data layer without having to build an API.`（react.dev）

キャッシュする関数について、Next.js の [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache)（2026-08-25 更新）は次のように書く。

- `Arguments to cached functions and their return values must be serializable.`（訳: キャッシュする関数の引数と戻り値は、単純なデータに書き出せる（シリアライズ可能）でなければならない）
- `When a cached function references variables from outer scopes, those variables are automatically captured and bound as arguments, making them part of the cache key.`（訳: 外側の変数を参照すると、自動で引数として取り込まれ、キャッシュの鍵の一部になる）
- 使えない型: `Class instances`、`Functions (except as pass-through)`

## Considered Options

* 画面ごとに作って渡す
* 機能ごとに組み立て用の関数を 1 か所に作る
* 組み合わせを自動で渡す道具（IoC Container）を入れる
* 係を渡さず、流れの中で D1 を直接使う

## Decision Outcome

**機能ごとに組み立て用の関数を 1 か所に作り、画面はそれを呼ぶだけにする（依存性の注入、dependency injection）。組み立て用の関数は `server/` に置く。キャッシュする関数（`'use cache'`）には単純な値だけを渡し、データを取り出す係はその関数の中で作る。**

組み立て用の関数を `server/` に置く形は、ADR-0026 の依存の向きの規則 3 に収まる。キャッシュする関数に単純な値だけを渡すのは、use cache が引数と戻り値にシリアライズ可能であることを求め、`Class instances` と `Functions (except as pass-through)` を使えない型とするためである。

### Consequences

* Good, because データベースなしでテストできる
* Neutral, because 組み立てを書く場所が 1 か所で、ライブラリが増えない
* Bad, because `import` で読み込んだ `env` が外側の変数として取り込まれるかは確認していない

### Confirmation

`'use client'` のファイルが `server/` を import しないことは、依存の向きの検査で確かめる（[ADR-0033](./0033-code-conventions-as-static-analysis.md)）。組み立て用の関数が機能ごとに 1 か所であることを判定する手段は定めていない。

## Pros and Cons of the Options

Next.js の公式の形との近さは、4 つの選択肢の中での順位で示す。

### 画面ごとに作って渡す

* Good, because データベースなしでテストできる
* Good, because ADOP のルール 2 を満たす
* Neutral, because ライブラリが増えない
* Neutral, because Next.js の公式の形との近さは 3 番目
* Neutral, because 画面ごとに書く

### 機能ごとに組み立て用の関数を 1 か所に作る — 採用

* Good, because データベースなしでテストできる
* Good, because ADOP のルール 2 を満たす
* Neutral, because 書く場所が 1 か所で、ライブラリが増えない
* Neutral, because Next.js の公式の形との近さは 2 番目

### 組み合わせを自動で渡す道具（IoC Container）を入れる

* Good, because データベースなしでテストできる
* Good, because ADOP のルール 2 を満たす
* Neutral, because 書く場所が 1 か所
* Neutral, because Next.js の公式の形との近さは 4 番目
* Neutral, because ライブラリが増える

### 係を渡さず、流れの中で D1 を直接使う

* Neutral, because ライブラリが増えない
* Neutral, because Next.js の公式の形との近さは 1 番目
* Bad, because データベースなしでテストできない
* Bad, because ADOP のルール 2 を満たさない

## More Information

- nrs: [ADOP (Application Domain Others Pattern)](https://nrslib.com/adop/)（公開 2020-12-13、更新 2021-04-23）
- Next.js: [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache)（2026-08-25 更新）
