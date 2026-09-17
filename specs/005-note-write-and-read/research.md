# Research: note を書いて公開し、読む

判断の基準は `docs/SOFTWARE_DESIGN.md` の設計原則とデザインパターン、`.specify/memory/constitution.md`。調べた日はすべて 2026-09-17。版は vinext 1.0.0-beta.9、@vinext/cloudflare 1.0.0-beta.7、wrangler 4.128.0。

## Contents

- R1. D1 への読み書き
- R2. 作り手以外を `/dash` に入れない
- R3. 公開した直後に訪問者の画面へ反映する
- R4. 書き込みの操作の作り方
- R5. 削除の確認の作り方
- R6. テストの割り当て
- R7. デプロイ時のキャッシュ判定と `/dash`

---

## R1. D1 への読み書き

**Decision**: ORM を使わない。D1 の prepared statement を、`src/features/note/server/` の Repository の実装の中だけで使う。スキーマの正本は、リポジトリ直下の `migrations/` に手で書く SQL とする。

- マイグレーションを作る命令: `npx wrangler d1 migrations create synsk-me <name>`。空のファイルができ、中身は手で書く
- 本番へ適用する命令: `npx wrangler d1 migrations apply synsk-me --remote`
- `wrangler.jsonc` に `migrations_dir` と `migrations_pattern` を書かない。既定の `migrations/` 直下の `.sql` を読む
- workerd のテストは `vitest.workers.config.ts` の `readD1Migrations` を `migrations/` に向け、本番と同じマイグレーションを当てる
- 表は `note`（書き換えている内容）と `note_publication`（見せている内容）の2つ。形は [data-model.md](./data-model.md)
- 公開してよいかは、Repository の実装が取り出すときに確かめる。訪問者向けの取り出しは `note_publication` の列だけを列挙して SELECT する
- slug の長さの上限を100文字とする。spec に値はない。設計原則2「止まる over 危ない方へ進む」が量に上限を求めるため置く

**Rationale**:
- D1 は SQL の `BEGIN` を受け付けない。ローカルで実行し、`D1_ERROR: To execute a transaction, please use the state.storage.transaction() ...` で拒まれることを確かめた。Drizzle の D1 向け `transaction()` は `begin` を発行し（`drizzle-orm/d1/session.js`）、kysely-d1 は `Transactions are not supported yet.` を投げる。どの案でも複数の文をまとめるには `db.batch()` を使うことになり、ORM を入れても差がない
- この機能の書き込みは、どれも1文で済む。公開は `INSERT ... SELECT ... ON CONFLICT DO UPDATE` の1文、削除は外部キーの `ON DELETE CASCADE` による1文
- `@cloudflare/vitest-plugin` の `readD1Migrations` はディレクトリ直下の `.sql` だけを読む。Drizzle の生成物は入れ子（`<ts>_name/migration.sql`）で、既存のテスト基盤のままでは読めない
- 設計原則9「単純さ over 先回りの構造」: クエリは5種類で、ORM を入れる具体的な理由（差し替え、2つ目の使い道）がない
- 設計原則8「置き場を選ばない」: D1 に固有の API は Repository の実装に閉じる。Drizzle もスキーマの定義が方言ごとに別で、D1 から移るときの書き直しは避けられない

**Alternatives considered**:
- Drizzle ORM: 公式が案内する版（1.0.0-rc.4）と npm の latest（0.45.2）が食い違う。列を変えて SQLite の表を作り直すとき、cascade の削除を考慮しない不具合（drizzle-team/drizzle-orm#4938）が OPEN のまま
- Kysely と kysely-d1: D1 の dialect は第三者製で、最終コミットは 2025-04-19。マイグレーションは手書きになり、依存が2つ増えるだけ
- 正本を `schema.sql` とマイグレーションの2つに持つ: 突き合わせる手間が増える。全体を1枚で読みたいときは `npx wrangler d1 export synsk-me --local --no-data` で導出する

**Sources**:
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/platform/limits/
- https://orm.drizzle.team/docs/connect-cloudflare-d1
- https://github.com/drizzle-team/drizzle-orm/issues/4938

## R2. 作り手以外を `/dash` に入れない

**Decision**: 2段で守る。

1. **Cloudflare Access（アプリケーションの外）**
   - 本番: self-hosted のアプリケーションを作り、対象を `synsk.me/dash` と `synsk.me/dash/*` の2つにする
   - プレビュー URL: Worker `synsk-me` のプレビュー全体を対象にするアプリケーション（destination の種類 `preview_worker`）を作る
   - どちらも、許可するのはオーナーのメールアドレス1件。ログインはメールに届くコードを入力する方式（One-time PIN）
2. **アプリケーションの中**: Access が付ける `Cf-Access-Jwt-Assertion` の JWT を検証する関数を1つ作り、`/dash` 配下のすべての画面と、すべての書き込みの操作の入口で呼ぶ
   - 検証する項目: 署名（RS256、`kid` に合う公開鍵）、`iss`、`aud`、`exp`、`nbf`、`email` がオーナーのものと一致すること
   - 公開鍵は `<issuer>/cdn-cgi/access/certs` から実行時に取る
   - 設定値（issuer、aud、オーナーのメールアドレス）は Worker の secret に置き、リポジトリに書かない
   - 次のどれかに当たれば止める: JWT がない、検証に失敗する、設定値が欠けている
   - 止めるとき、画面はページの中で `forbidden()`（403）を返し、操作は何も書き込まずに失敗を返す（R7）
   - JWT の検証には `jose` を使う
3. **配信後の検査**: `npm run verify:deploy` に、認証なしの要求が Access のログインへ移されることの検査を足す。プレビュー URL を検査するときは、Access の service token をヘッダに付けて通す。service token は `.env.local` に置く

**Rationale**:
- vinext の Server Action は経路に縛られない。`Next-Action` ヘッダの ID から関数を引き、どの経路に紐づくかを確かめない（`vinext/dist/server/app-server-action-execution.js`）。`/dash/*` だけを守る Access では、`/` への POST で `/dash` の操作を呼べる。Next.js の公式も、Server Action ごとに認証を確かめるよう書いている
- 設計原則1「守る over 手軽さ」と2「止まる over 危ない方へ進む」: Access の設定が漏れても、アプリケーションが書き込みを止める
- `ctx.access` は使えない。公式は、静的アセットを持つ Worker では `ctx.access` が渡らないと書いている。`wrangler.jsonc` は `assets` を持つ
- 公開鍵は6週ごとに入れ替わる。コードに埋め込まない
- `/dash` の対象に `synsk.me/dash` を別に並べるのは、公式が `example.com/alpha/*` は `example.com/alpha` を含まないとするため。`synsk.me/dash*` は `/dashboard` のような経路まで含む
- プレビュー URL はパス単位で守れない。プレビューの版も本番と同じ D1 に書き込むため、全体を閉じる
- `jose` は Cloudflare の公式の Workers の例が使う。Web Crypto だけでも書けるが、公開鍵の取得と `kid` の照合と時刻の検査を自分で持つことになり、設計原則3「少なく正しく」に反する

**Alternatives considered**:
- Access だけで守る: Server Action が経路に縛られないため、FR-010 を満たせない
- アプリケーションの中だけで守る: ADR-0013 が認証をアプリケーションの外で行うと決めている。ログインの画面とセッションを持つことになる
- ログインを Cloudflare のアカウントで行う方式: 2要素認証に乗れる。オーナーが 2026-09-17 にメールのコードで入る方式を選んだ

**Owner action required**: Access を使うには Zero Trust の組織が要る。2026-09-17 に Cloudflare API で確かめると、`GET /accounts/{id}/access/organizations` が `Access is not enabled` を返した。組織の作成はダッシュボードで行い、team name と支払い情報を求められる。

**Sources**:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://nextjs.org/docs/app/guides/data-security

## R3. 公開した直後に訪問者の画面へ反映する

**Decision**: `/notes/[slug]` と `/dash` 配下のページは `export const dynamic = 'force-dynamic'` とし、エッジのキャッシュに載せない。要求のたびに D1 から描画する。`generateStaticParams` を置かない。

**Rationale**:
- `docs/REQUIREMENTS.md` の FR-17（公開の後に別の工程を挟まずに反映）を、キャッシュの削除なしで満たせる。キャッシュに載せると `revalidatePath` による削除が要り、削除が失敗すると `stale-while-revalidate`（1年）の間、削除した note まで出続けうる。設計原則2「止まる over 危ない方へ進む」
- `/dash` の HTML をキャッシュに載せると、キャッシュのキーはホスト名を含まず、Worker より先に引かれる（公式の cache-keys）。作り手の画面が訪問者に返りうる。設計原則1
- 表示速度（NFR-03〜NFR-07）のために `/notes/[slug]` をキャッシュに載せるかは、計測してから決める。設計原則6「測って直す over 先回りで速くする」
- `vite.config.ts` の `prerender: { routes: '*' }` は、`cloudflare:workers` を読み込むページをビルド時に Node で描画しようとして落ちる（`ERR_UNSUPPORTED_ESM_URL_SCHEME`）。`force-dynamic` のページは事前描画の対象から外れ、ビルドが通ることを確かめた

**Alternatives considered**:
- `revalidate` と `generateStaticParams() { return [] }` でキャッシュに載せ、公開・削除のたびに `revalidatePath` で消す: タグでの削除は本番でしか確かめられず、失敗したときに古い内容が長く残る

**Constitution との関係**: constitution の Cacheability は「すべての `page.tsx` は正の `export const revalidate` を持つ」と書く。`tests/unit/cacheability.test.ts` は `force-dynamic` のページを除外して通す。文面と検査が食い違っており、この機能のページは検査には通るが文面に反する。[plan.md](./plan.md) の Complexity Tracking に書く。

**Sources**:
- https://developers.cloudflare.com/workers/cache/cache-keys/
- https://developers.cloudflare.com/workers/cache/purge/
- `node_modules/vinext/dist/build/prerender-paths.js`

## R4. 書き込みの操作の作り方

**Decision**: 書き込みの操作は、`<form action>` に渡す Server Action で作る。入力の誤りと失敗は `useActionState` で画面に返し、入力した値を残す。成功した後の移動は `redirect()` による。D1 の binding は `import { env } from "cloudflare:workers"` で取る。

**Rationale**:
- JavaScript なしでもフォームの送信が動き、`redirect()` は 303 になることを、ビルド出力を `wrangler dev` で動かして確かめた。JavaScript ありでも同じ結果になった
- `useActionState` は、JavaScript なしでも、誤りの文言と入力した値を返した
- vinext は Server Action の POST で Origin を確かめる（`validateCsrfOrigin`）
- `cloudflare:workers` から env を取る方法は、vinext の README が推奨する

**Alternatives considered**:
- Route Handler（`route.ts`）に POST する: JavaScript なしのフォームで入力の誤りを画面に返すには、リダイレクトと値の受け渡しを自分で持つことになる

**Sources**:
- `node_modules/vinext/README.md`（Server Actions、Cloudflare Bindings の節）
- `node_modules/vinext/dist/server/app-server-action-execution.js`

## R5. 削除の確認の作り方

**Decision**: 削除の確認は、別の画面（`/dash/notes/{id}/delete`）にフォームを置いて行う。ダイアログにしない。

**Rationale**:
- JavaScript なしで動き、キーボード・読み上げ・スマートフォンで同じ操作ができる（設計原則5、constitution V）
- 開閉やフォーカスの移動を持たないため、headless のライブラリが要らない。設計原則9。2026-09-17 時点で Radix などの headless のライブラリは依存に入っていない

**Alternatives considered**:
- headless のライブラリのダイアログ: `docs/SOFTWARE_DESIGN.md` の「見た目と操作を分ける」に沿うが、ライブラリを新しく選ぶ判断と依存が増える。確認に開閉は要らない

## R6. テストの割り当て

**Decision**: constitution の Test Layering に従い、同じことを2つの段階で確かめない。

| 段階 | 確かめること |
|---|---|
| 単体（`npm test`） | slug・題・本文の規則、ユースケースの規則（偽の Repository を渡す）、JWT の検証（テスト用の鍵で署名したもの） |
| workerd（`npm run test:workers`） | D1 の Repository の実装を本物のマイグレーションに当てたもの。下書きが訪問者向けの取り出しに出ない、公開し直しても初めて公開した日が変わらない、削除で公開の行も消える、データベースの制約 |
| 結合（`npm run test:integration`） | ビルド出力の経路: `/notes/{slug}` の 200 と、下書き・存在しない slug の 404 が同じ中身、JWT のない `/dash` の 403、JWT のない書き込みの操作が何も書き込まない、`/dash` 配下がデプロイ時のキャッシュ判定の対象に入らない（R7） |
| E2E（`npm run test:e2e`） | 作り手として作る → 公開する → 訪問者として読む → 書き換えて公開し直す → 削除する。JavaScript を切った状態で行う |
| 配信後（`npm run verify:deploy`） | 本番の `/dash` が Access のログインへ移される。プレビュー URL の `/` が Access のログインへ移される |

- 既存の `tests/workers/d1-plumbing.test.ts` と `tests/fixtures/migrations/0001_probe.sql` は、D1 の配管を確かめるためのもの。Repository のテストが同じ配管を通るため、廃止する
- E2E で作り手として操作するには、テスト用の鍵で署名した JWT と、その公開鍵を配る先が要る。本番のコードに試験用の分岐を持たせず、設定値（issuer）の向け先だけを変える。方法は実装で確かめる

## R7. デプロイ時のキャッシュ判定と `/dash`

**Decision**:
- `next.config.js` の `rewrites()` の `fallback` に、`/dash/:path*` から同じ経路への rewrite を置き、`/dash` 配下をデプロイ時のキャッシュ判定の対象から外す
- 作り手であることを確かめられないとき、画面はページの中で `forbidden()`（403）を返す。middleware で拒まず、例外を投げない
- ビルド出力の `dist/server/vinext-prerender-paths.json` に `/dash` 配下が入らないことを、結合テストで確かめる

**Rationale**:
- `npm run deploy` は、配信の前に `https://synsk.me` の各経路へ要求を送り、キャッシュしてよいかを判定する。応答が 2xx でない経路があると、デプロイ全体が止まる（`@vinext/cloudflare/dist/cacheability-probe.js` の 121〜141行、`deploy.js` の 864行）
- 判定の要求は本番のホストへの通常の要求である。Access が `/dash` を守ると、Worker より前にログインへの移動を返し、デプロイが止まる見込み。Access が Worker より前に応答するという順序は、公式の文書で確かめきれていない（推測）
- `force-dynamic` にしても、動的セグメントを持たない経路（`/dash`、`/dash/notes/new`）は判定の対象に残る（`vinext/dist/build/prerender-paths.js` の 420〜422行）
- next.config の rewrites の source に当たる経路は、判定の対象から外れる（`prerender-paths.js` の 635〜647行）。scratchpad でビルドし、`excludedWarmPaths` が `["/dash","/dash/notes/new"]` になり、判定の対象が `/` と `/archives/2024` だけになることを確かめた
- 判定の表に載らない経路は、実行時に `no-store` になる（`vinext/dist/server/cacheability-request.js` の 376・384行）。作り手の画面がキャッシュに載らない。設計原則1
- ページの中の `forbidden()` は、判定の要求に届いた場合も `dynamic` と分類され、デプロイを止めない。middleware の 403 とページの例外（500）は、判定に失敗してデプロイを止める。手元の `wrangler dev` に判定の要求を送って確かめた
- この除外は vinext の内部の挙動で、公式の文書にない。版を上げたときに外れていないことを、ビルド出力で確かめる

**Alternatives considered**:
- `/dash` 配下を動的セグメントの下に置く（`/dash/[[...path]]`）: 対象から外れるが、配信の都合で経路の形を歪める。設計原則9
- 管理画面を別のホスト（`dash.synsk.me`）に置く: `synsk.me/dash` をアプリケーションの JWT の検証だけで守ることになり、ADR-0016 の経路とも合わない。設計原則1
- Access に判定の要求だけを通させる: Access の Bypass は識別子を使う条件に対応せず、ヘッダを条件にできない

**Sources**:
- `node_modules/@vinext/cloudflare/dist/cacheability-probe.js`
- `node_modules/@vinext/cloudflare/dist/deploy.js`
- `node_modules/vinext/dist/build/prerender-paths.js`
- `node_modules/vinext/dist/server/cacheability-request.js`
