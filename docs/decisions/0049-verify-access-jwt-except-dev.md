---
status: accepted
date: 2026-11-04
decision-makers: synsk
consulted: Claude Code
---

# オーナーの画面と書き込みの操作は、Cloudflare Access に加えてアプリケーションの中でもオーナーであることを確かめる。npm run dev のときだけ確かめない

## Context and Problem Statement

[ADR-0036](./0036-verify-access-jwt-in-app.md) は、オーナーの画面を返す前と、書き込みの操作を行う前に、アプリケーションが `Cf-Access-Jwt-Assertion` の JWT を検証すると決めた。JWT がない、検証に失敗する、検証に要る設定値が欠けている、のどれかに当たれば、画面を返さず、書き込まない。

手元の `npm run dev`（vinext dev）の前には、JWT を付ける Cloudflare Access がいない。このため手元では、オーナーの画面を開けず、書き込みの操作も試せない。

ADR-0036 のほかの決定は変わっていない。[docs/decisions/README.md](./README.md) は、承認した記録の決定内容を変えず、覆すときは新しい記録を書くと定める。1 点だけを変えるときも、元の記録をまるごと引き継ぐ新しい記録を書く（[#72 のコメント 6231369601](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6231369601)）。この記録は ADR-0036 を引き継ぎ、手元の開発での扱いを足す。

ADR-0036 が 2026-09-17 に確かめた事実は、次のとおり。

- vinext 1.0.0-beta.9 の Server Action は、要求の `Next-Action` ヘッダの ID から関数を引き、その関数がどの経路のものかを確かめない（`node_modules/vinext/dist/server/app-server-action-execution.js`）。`/dash/` の外の経路への POST から、`/dash/` のフォームが使う操作を呼べる作りである
- Next.js の公式は、Server Action を直接の POST で届くものとして扱い、1つずつの中で認証を確かめるよう書いている
- Cloudflare の公式は、静的アセットを持つ Worker には `ctx.access` が渡らないと書いている。`wrangler.jsonc` は `assets` を持つ
- Workers のプレビュー URL を Access で守る単位は、Worker 全体かアカウント全体で、パス単位ではない

2026-10-09 から、ブランチのプレビュー URL の版は、本番の D1 ではなく D1 `synsk-me-preview` に書き込む（PR #132）。

手元の開発でオーナーとして操作する方法を、2026-11-04 に比べた。

- Cloudflare の公式は、`ctx.access` と、手元の開発で使う `access.dev` を用意している（[Workers: Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)）。同じ公式に「Workers with Static Assets execute behind an internal router Worker. … the router does not pass `ctx.access` to the user Worker.」とあり、このアプリケーションは `dist/server/wrangler.json` に `assets` を持つ。手元で試したところ、vinext の cdnAdapter が描画を `ctx.exports` への折り返しの fetch で行うため、wrangler dev では描画まで届かなかった
- Vite は `import.meta.env.DEV` と `import.meta.env.MODE` を、build のときに定数へ置き換える（[Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode)）
- Cloudflare の公式は、開発のときだけ JWT の検証を飛ばす形を、勧めても禁じてもいない（記述がない）

## Decision Drivers

* 守る over 手軽さ（`docs/SOFTWARE_DESIGN.md` の設計原則1）
* 止まる over 危ない方へ進む（同 設計原則2）

## Considered Options

オーナーであることを確かめる場所

* Access だけで守る
* Access で守り、アプリケーションの中でも Access の JWT を検証する
* アプリケーションの中だけで守る

手元の開発でオーナーとして操作する方法

* `npm run dev` のときだけ、build で消える分岐でオーナーの判定を飛ばす
* Cloudflare 公式の `ctx.access` と `access.dev` を使う
* Cloudflare Tunnel で手元を Access の後ろに置く
* E2E と同じ手元の鍵サーバと、JWT を付ける中継を使う

## Decision Outcome

Chosen option: "Access で守り、アプリケーションの中でも Access の JWT を検証する", because Access だけでは、経路に縛られない Server Action を守れないため。

Chosen option: "`npm run dev` のときだけ、build で消える分岐でオーナーの判定を飛ばす", because 手元で `npm run dev` だけを起動すればオーナーとして操作でき、build したものには分岐が残らないため。

- Access は2つのアプリケーションで掛ける。本番の `synsk.me/dash` と `synsk.me/dash/*`、Worker `synsk-me` のプレビュー全体
- アプリケーションは、オーナーの画面を返す前と、書き込みの操作を行う前に、`Cf-Access-Jwt-Assertion` の JWT を検証する。署名、発行元、対象（aud）、期限、メールアドレスがオーナーのものであることを確かめる
- JWT がない、検証に失敗する、検証に要る設定値が欠けている、のどれかに当たれば、画面を返さず、書き込まない
- 検証に要る設定値は Worker の secret に置く
- `npm run dev`（vinext dev）のときだけ、オーナーの判定を飛ばしてオーナーとして扱う。分け方は `import.meta.env.DEV && import.meta.env.MODE === 'development'` とし、Vite が build のときに定数へ置き換える。実行時の環境変数では切り替えない

### Consequences

* Good, because Access の設定が漏れても、アプリケーションが書き込みを止める
* Good, because 手元で `npm run dev` だけを起動すれば、オーナーの画面と書き込みの操作を試せる
* Good, because build したもの（`dist/`）には判定を飛ばす分岐が残らない。本番とプレビューの版で、実行時の値を変えても判定を飛ばせない
* Bad, because オーナーの画面と書き込みの操作を足すたびに、検証を呼ぶ必要がある。呼び忘れは型でも lint でも検出していない
* Bad, because E2E でオーナーとして操作するには、テスト用の鍵で署名した JWT と、その公開鍵を配る先が要る
* Bad, because プレビュー URL の全体が Access の後ろに入り、`npm run verify:deploy` でプレビュー URL を検査するときに service token が要る
* Bad, because `npm run dev` では、JWT の検証の経路を通らない。検証の振る舞いは、build したものに対する結合テストと E2E でだけ確かめられる

### Confirmation

- 結合テストが、JWT のない `/dash` の要求が 403 になり、JWT のない書き込みの操作が何も書き込まないことを確かめる
- `npm run verify:deploy` が、認証なしの `/dash` の要求が Access のログインへ移されることを確かめる
- `tests/integration/dev-author.test.ts` が CI で、build した `dist/` の `.map` 以外のどのファイルにも、判定を飛ばす分岐の中の固定の値が無いことを確かめる

## Pros and Cons of the Options

### Access だけで守る

* Good, because ADR-0013 のとおり、アプリケーションが認証を持たない
* Bad, because `/dash/` の外の経路から、書き込みの操作を呼べる

### Access で守り、アプリケーションの中でも Access の JWT を検証する

* Good, because 経路に縛られない操作も守れる
* Bad, because JWT の検証に依存（`jose`）が増える

### アプリケーションの中だけで守る

* Good, because Access の設定に頼らない
* Bad, because ログインの画面とセッションを持つことになり、ADR-0013 を覆す

### `npm run dev` のときだけ、build で消える分岐でオーナーの判定を飛ばす

* Good, because 起動するのは `npm run dev` の 1 つだけ
* Good, because 分岐は build のときに消え、実行時の環境変数では切り替わらない
* Bad, because 判定を飛ばす分岐をコードに持つ。分岐が build に残っていないことを、テストで確かめ続ける必要がある

### Cloudflare 公式の `ctx.access` と `access.dev` を使う

* Good, because Cloudflare の公式の仕組みで、手元でも Access の値を受け取れる
* Bad, because 静的アセットを持つ Worker には `ctx.access` が渡らない。このアプリケーションは `assets` を持つ
* Bad, because wrangler dev では、vinext の描画まで届かなかった（2026-11-04 に手元で確かめた）

### Cloudflare Tunnel で手元を Access の後ろに置く

* Good, because 手元でも本番と同じ JWT の検証を通る
* Bad, because Tunnel と Access の設定の手間が大きい（[Cloudflare One: Self-hosted public application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)）

### E2E と同じ手元の鍵サーバと、JWT を付ける中継を使う

* Good, because 手元でも JWT の検証を通る
* Bad, because 起動するものが 3 つあり、毎日の確認に向かない

## More Information

この記録は [ADR-0036](./0036-verify-access-jwt-in-app.md) を置き換える。ADR-0036 の決定はすべてこの記録が引き継ぎ、`npm run dev` のときの扱いを足す。

ADR-0036 の Context の「ブランチごとのプレビュー URL の版は、本番と同じ D1 に書き込む」と、Consequences の「プレビュー URL から本番の D1 への書き込みも、同じ検証を通る」は、2026-10-09 から成り立たない（ADR-0036 の More Information）。この記録には引き継がない。

- [ADR-0013: 認証をアプリケーションの外で行う](./0013-access-authentication.md)
- [ADR-0016: URL の規則](./0016-url-conventions.md)
- [Cloudflare Access: Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Workers: Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)
- [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode)
