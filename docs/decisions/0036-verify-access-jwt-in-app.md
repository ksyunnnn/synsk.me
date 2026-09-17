---
status: proposed
date: 2026-09-17
decision-makers: synsk
consulted: Claude Code
---

# 作り手の画面と書き込みの操作は、Cloudflare Access に加えてアプリケーションの中でも作り手であることを確かめる

## Context and Problem Statement

ADR-0013 は、認証をアプリケーションの外で行い、Cloudflare Access で判定すると決めた。ADR-0016 は、管理画面を `/dash/` 配下に置くと決めた。Access を `/dash/` に掛けるだけで、作り手以外が書き込みの操作に届かなくなるかを、2026-09-17 に確かめた。

- vinext 1.0.0-beta.9 の Server Action は、要求の `Next-Action` ヘッダの ID から関数を引き、その関数がどの経路のものかを確かめない（`node_modules/vinext/dist/server/app-server-action-execution.js`）。`/dash/` の外の経路への POST から、`/dash/` のフォームが使う操作を呼べる作りである
- Next.js の公式は、Server Action を直接の POST で届くものとして扱い、1つずつの中で認証を確かめるよう書いている
- Cloudflare の公式は、静的アセットを持つ Worker には `ctx.access` が渡らないと書いている。`wrangler.jsonc` は `assets` を持つ
- ブランチごとのプレビュー URL の版は、本番と同じ D1 に書き込む。`wrangler.jsonc` の D1 の設定が1つだけであるため
- Workers のプレビュー URL を Access で守る単位は、Worker 全体かアカウント全体で、パス単位ではない

## Decision Drivers

* 守る over 手軽さ（`docs/SOFTWARE_DESIGN.md` の設計原則1）
* 止まる over 危ない方へ進む（同 設計原則2）

## Considered Options

* Access だけで守る
* Access で守り、アプリケーションの中でも Access の JWT を検証する
* アプリケーションの中だけで守る

## Decision Outcome

Chosen option: "Access で守り、アプリケーションの中でも Access の JWT を検証する", because Access だけでは、経路に縛られない Server Action を守れないため。

- Access は2つのアプリケーションで掛ける。本番の `synsk.me/dash` と `synsk.me/dash/*`、Worker `synsk-me` のプレビュー全体
- アプリケーションは、作り手の画面を返す前と、書き込みの操作を行う前に、`Cf-Access-Jwt-Assertion` の JWT を検証する。署名、発行元、対象（aud）、期限、メールアドレスがオーナーのものであることを確かめる
- JWT がない、検証に失敗する、検証に要る設定値が欠けている、のどれかに当たれば、画面を返さず、書き込まない
- 検証に要る設定値は Worker の secret に置く

### Consequences

* Good, because Access の設定が漏れても、アプリケーションが書き込みを止める
* Good, because プレビュー URL から本番の D1 への書き込みも、同じ検証を通る
* Bad, because 作り手の画面と書き込みの操作を足すたびに、検証を呼ぶ必要がある。呼び忘れは型でも lint でも検出していない
* Bad, because E2E で作り手として操作するには、テスト用の鍵で署名した JWT と、その公開鍵を配る先が要る
* Bad, because プレビュー URL の全体が Access の後ろに入り、`npm run verify:deploy` でプレビュー URL を検査するときに service token が要る

### Confirmation

- 結合テストが、JWT のない `/dash` の要求が 403 になり、JWT のない書き込みの操作が何も書き込まないことを確かめる
- `npm run verify:deploy` が、認証なしの `/dash` の要求が Access のログインへ移されることを確かめる

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

## More Information

- [ADR-0013: 認証をアプリケーションの外で行う](./0013-access-authentication.md)
- [ADR-0016: URL の規則](./0016-url-conventions.md)
- [Cloudflare Access: Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Workers: Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)
