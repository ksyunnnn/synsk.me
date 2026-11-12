# synsk.me

小橋俊介のポートフォリオであり、共創の入り口。外部プラットフォームでの発信を集約し、時系列で見せる。

- ビジョン: [docs/VISION.md](./docs/VISION.md)
- 満たすべきこと: [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- 決定の記録: [docs/decisions/](./docs/decisions/)
- どこに何を書くか: [docs/README.md](./docs/README.md)

## 技術スタック

- 言語: TypeScript
- フレームワーク: Next.js 16（App Router）。Cloudflare Workers 上では [vinext](https://vinext.dev/) を介して動く
- スタイル: Tailwind CSS
- 配信: Cloudflare Workers（Workers Free。2026-11-10 にダッシュボードの「Workers のプラン」で確認）
- サブドメインのサイトが読み込む部品: Web Components

設定は `wrangler.jsonc`（Worker）と `vite.config.ts`（ビルド）が持つ。採用の理由は [docs/decisions/](./docs/decisions/) にある。

## 開発

Node.js 24 を使う（`.nvmrc`）。`package.json` の `engines` は 22 以上を求める。依存はワークスペースの直下で入れる。

```bash
npm i # 依存を入れる
cp ../../private/.dev.vars .dev.vars   # 手元の設定値を写す
cp ../../private/.env.local .env.local # 手元の環境変数を写す
```

`.dev.vars` と `.env.local` の原本は、リポジトリの外の `synsk.me/private/` に置く。`synsk.me/private/` は git で手元だけに管理し、リモートを持たない。値を変えるときは原本を直し、各ワークスペースへ写し直す。

```bash
npm run dev        # 開発サーバー（http://localhost:3000）
npm run build      # プロダクションビルド（出力は dist/）
npm run lint       # リンター
npm run preview    # ビルドして Workers ランタイムでローカル起動
npm run deploy     # ビルド済みの dist をデプロイし、配信を検査する
npm run preview:branch # ビルド済みの dist から、ブランチの Preview を作る
npm run verify:deploy # 配信されているものを検査する（URL を渡すとその対象を見る）
npm run cf-typegen # binding の型を cloudflare-env.d.ts に生成
```

デザインは `design/*.pen` が持つ。[pen.dev](https://pen.dev) のアプリで開く。アプリ名は `Pen` である。

```bash
open -a Pen design/<file>.pen                    # 開く
npm install -g @pen.dev/cli                      # 保存に使う。初回は pen login で認証する
pen interactive -a desktop -i design/<file>.pen  # 対話シェル。save() がファイルへ書き込む
```

### 手元の D1

手元の D1 はワークスペース（`desk-NN`）ごとに別で、`.wrangler/state` の下にある。コマンドはワークスペースの直下で実行する。

**最初に用意する**

```bash
npx wrangler d1 migrations apply synsk-me --local                            # 表を作る
npx wrangler d1 execute synsk-me --local --file ../../private/seed-local.sql # seed を入れる
bash ../../private/upload-media-local.sh                                     # seed の本文が指す画像を手元の R2 に置く
```

**seed を入れ直す**

```bash
npx wrangler d1 execute synsk-me --local --file ../../private/seed-local.sql
```

seed は入れる表を先に空にするため、何度入れても行は重ならない。seed は実名を含むため、リポジトリに入れず `synsk.me/private/seed-local.sql` に置く。表の制約が変わったら、seed も合わせて直す。

**マイグレーションが増えたとき**

```bash
npx wrangler d1 migrations apply synsk-me --local # まだ当てていないものだけを当てる
```

手元の D1 の中身は `sqlite3` で見る。

```bash
sqlite3 -header -column $(ls .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | grep -v metadata)
```

```
.prompt "sqlite> " "   ...> "  -- 行頭の表示を短くする
.tables                        -- 表の一覧
.mode line                     -- 1 行を縦に並べる
.quit                          -- 終える
```

## データベース

Cloudflare D1 のデータベース `synsk-me`（binding `DB`）。スキーマはリポジトリ直下の `migrations/` の SQL が持つ。

```bash
npx wrangler d1 migrations create synsk-me <name>  # migrations/ に空のマイグレーションを作る。中身は手で書く
npx wrangler d1 migrations apply synsk-me --remote # 本番の D1 に、まだ当てていないマイグレーションを当てる
```

ブランチの Preview は、本番と分けた D1 `synsk-me-preview` を使う。`npm run test:workers` と結合・E2E のテストは、`migrations/` を手元の D1 に当ててから走る。

## テスト

```bash
npm test              # 単体。純関数とソースの静的な検査
npm run test:watch    # 単体を watch で回す
npm run test:workers  # workerd の中。D1 の binding とマイグレーション
npm run test:migrations # 既にある行を移すマイグレーションを、当てる前に一度だけ確かめる
npm run test:integration # 結合。ビルドしてから本番出力を workerd で起動する
npm run test:e2e      # E2E。ビルドしてから実ブラウザで開く
```

E2E の前に `npx playwright install chromium` でブラウザを入れる。

既にある行を移すマイグレーションのテストは `tests/migrations/` に置く。表の制約のテストは `tests/workers/migrations.test.ts` に置く。CI は `tests/migrations/` を、`migrations/` か `tests/migrations/` が変わったときだけ回す。

段階ごとの割り当てと時間の上限は [docs/decisions/0019-testing-strategy.md](./docs/decisions/0019-testing-strategy.md) が定める。

| 段階 | 回すもの | Tolerable | Goal |
|---|---|---|---|
| 手元 watch | `npm run test:watch` | 10 秒 | 1 秒 |
| コミット前 | `npm test` `npm run test:workers` `npm run cf-typegen` `npm run build` `npx tsc --noEmit` `npx tsc --noEmit -p tests/tsconfig.json` `npm run lint` `npm run format:check`（この順。型検査は `cf-typegen` と `build` が生成する型を読む） | 60 秒 | 30 秒 |
| PR の CI | 上記と結合・E2E。CI はビルドを 1 回に抑えるため `test:integration:only` と `test:e2e:only` を呼ぶ | 10 分 | 5 分 |

設定は 4 つに分かれる。単体と workerd は vinext を読み込まない。vinext は公開の `next/*` を自前の shim に置き換えるため、読み込まない設定では `next/*` が `next` パッケージの実体へ解決される。

| ファイル | 対象 |
|---|---|
| `vitest.config.ts` | 単体 |
| `vitest.workers.config.ts` | workerd の中 |
| `vitest.integration.config.ts` | 結合 |
| `playwright.config.ts` | E2E |

ビジュアル回帰は入れていない。基準画像は OS ごとに別のファイルになり、Linux の CI でしか撮れない。比較する対象が増えた時点で足す。`playwright.config.ts` の `snapshotPathTemplate` と `.gitignore` の `*-darwin.png` は、そのときのために置いてある。

デプロイ後の検査は `npm run verify:deploy` が担う。エッジのキャッシュ・ビルド時に埋まる環境変数・PNG の実体は、デプロイ前には確かめられない。

### カバレッジ

必要なときに手で測る。上の段階には含めない。率は、実装が正しいかの判定に使わない（[docs/decisions/0019-testing-strategy.md](./docs/decisions/0019-testing-strategy.md)）。

```bash
npx vitest run --config vitest.config.ts --coverage.enabled --coverage.provider=v8 --coverage.include='src/**/*.{ts,tsx}' --coverage.include='worker/**/*.ts' --coverage.exclude='**/*.d.ts'               # 単体
npx vitest run --config vitest.workers.config.ts --coverage.enabled --coverage.provider=istanbul --coverage.include='src/**/*.{ts,tsx}' --coverage.include='worker/**/*.ts' --coverage.exclude='**/*.d.ts' # workerd の中
```

- 分母は `src/` の `.ts`・`.tsx`（`.d.ts` を除く）と `worker/` の `.ts`。`--coverage.include` を省くと、テストが読み込んだファイルだけが分母になる（[Coverage](https://v4.vitest.dev/config/coverage)）
- workerd は istanbul を使う。workerd は V8 のカバレッジに対応していない（[Known issues](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/)）
- 結果は `coverage/` に出る。git は追跡しない

## 配信

本番は Cloudflare Workers Builds が `main` への push を受けてビルドし、デプロイする。ビルド構成はリポジトリではなく Cloudflare のダッシュボード（Workers & Pages → `synsk-me` → Settings → Build）が持つ。

| 欄 | 値 |
|------|------|
| ビルド コマンド | `npm run build` |
| デプロイ コマンド | `npm run deploy` |
| バージョン コマンド | `npm run preview:branch` |
| プロダクション ブランチ | `main` |

**`deploy` と `preview:branch` はビルドしない。** ビルド コマンドが作った `dist/` を前提にする。手元で使うときは `npm run build` を先に実行する。両方がビルドすると 1 回分（手元の実測で 8.6 秒）が無駄になる。

**3 欄は `npm run` を通す。** コマンドの実体を `package.json` に置き、リポジトリ側だけを読めば配信の手順が分かる状態にするため。ダッシュボードにコマンドを直接書くと、リポジトリの変更と食い違っても誰も気づけない。

**デプロイとバージョンのコマンドは `dist/server/wrangler.json` を指す。** `vinext build` はリポジトリ直下の `wrangler.jsonc` を読み、binding とアセットの位置を解決した設定を `dist/server/wrangler.json` に書き出す。直下の `wrangler.jsonc` を渡すと `dist/client` が未解決のまま扱われる。`--skip-build` はビルド コマンドとの二重ビルドを避ける。この欄はリポジトリから読めないため、デプロイの挙動が説明と合わないときは実装より先にここを見る。

**デプロイ時のキャッシュ判定（`--warm-cache`）を使わない。** 判定は本番の URL の各経路へ要求を送り、Access が守る `/dash` は 302 を返してデプロイを止める。キャッシュに載せるページは `'use cache'` で選ぶ（[ADR-0042](./docs/decisions/0042-vinext-1-2-upgrade.md)）。

`/` をキャッシュに載せるのは、ページの `'use cache'` と `cacheLife()` である。キャッシュは Cache Components で作り、`export const revalidate` と `export const dynamic` は書かない（ADR-0040）。

`main` 以外のブランチはバージョン コマンドでビルドされ、PR にプレビュー URL がコメントされる。

**プレビュー配信は、どの応答もキャッシュに残さない。** 全体が Access の後ろにあり、どの応答も認証を要するため（NFR-09）。Worker の入口 `worker/index.ts` が `*.workers.dev` への応答を `no-store` にし、静的ファイルは `public/_headers` のプレビューの規則が `no-store` にする（[ADR-0041](./docs/decisions/0041-preview-no-store.md)）。エッジのキャッシュに当たるかは、本番で確かめる。

## 配信の検査

`npm run deploy` はデプロイの後に `scripts/verify-deploy.mjs` を実行する。**通らなければデプロイが失敗として扱われる。** 検査するのは、過去に実際に壊れたものと、オーナーの画面を守る Access の設定と、note の応答がキャッシュに載らないことである。

| 検査 | 落ちたときに疑うもの |
| --- | --- |
| `/`、`/icon`、`/opengraph-image` が 200 を返す | 経路の設定、ビルドの出力 |
| `/icon` と `/opengraph-image` が実体のある PNG を返す | `workerd` 上の satori と resvg |
| `/archive-banner.js` が帯の定義を 200 で返す | `public/archive-banner.js` の削除や改名。過去の版のサイトが外から読み込んでいる |
| `/` の 2 回目が `cf-cache-status: HIT` を返す | ページの `'use cache'` と `cacheLife()` |
| HTML に GTM のタグが入る | `next.config.js` の `env`、`WORKERS_CI_BRANCH` |
| `/` の `og:image` が `https://synsk.me` の絶対 URL を指す | `next.config.js` の `SITE_ORIGIN`、`src/app/layout.tsx` の `metadataBase` |
| HTML が 8 KB、クライアント JS が 200 KB 以内（gzip） | 依存の増加、フォントの読み込み |
| 認証なしの `/dash` と `/dash/notes/new` が Access のログイン（`*.cloudflareaccess.com`）へ移される | Access のアプリケーションの対象の経路 |
| プレビュー配信では、認証なしの `/` も Access のログインへ移される | プレビュー全体を対象にする Access のアプリケーション |
| `/notes/<存在しない slug>` が 404 を返す | `src/proxy.ts` の rewrite、`src/app/notes/[slug]/missing/page.tsx` |
| `/notes/<存在しない slug>` の 2 回目が `cf-cache-status: HIT` を返さない | `src/proxy.ts` の `matcher` |
| プレビュー配信では、`/`、`/icon`、`/opengraph-image`、`/dash`、`/notes/<存在しない slug>` が `no-store` を返し、`CDN-Cache-Control` を返さず、2 回目が `cf-cache-status: HIT` を返さない。`/archive-banner.js` とクライアント JS が `no-store` を返す | `worker/index.ts`、`public/_headers` のプレビューの規則 |

プレビュー配信を見るときは URL を渡す。

```bash
npm run verify:deploy -- https://<version>-synsk-me.is-syunsukekobashi.workers.dev
```

プレビュー配信は全体が Access の後ろにあるため、Access のログインへの移動を見る検査のほかは、service token を `CF-Access-Client-Id` と `CF-Access-Client-Secret` のヘッダに付けて取る。`CLOUDFLARE_ACCESS_CLIENT_ID_PREVIEW` と `CLOUDFLARE_ACCESS_CLIENT_SECRET_PREVIEW` が欠けていれば検査は落ちる。本番には付けない。本番の Access は `/dash` だけを守り、検査は `/dash` がログインへ移されることを鍵なしで確かめるため、本番の service token は持たない。

エッジのキャッシュの検査は、訪問者のブラウザと同じ形のヘッダで行う。

**予算の検査は、HTML もチャンクもキャッシュを迂回して取る。** 昇格の直後、キャッシュには新しい版の HTML があり、Worker はまだ古い版で応答しうる。キャッシュ済みの HTML が参照するチャンクを古い版に求めると 404 になる（[ADR-0022](./docs/decisions/0022-deploy-version-window.md)）。

## コンソール

サイトの運用に使う外部の管理画面。開いた先で対象を選ぶ。アカウント ID とプロパティ ID は書かない。配信される HTML と JS に出ていないため、書けば新たに公開することになる。

| 対象 | 選ぶもの | 用途 |
|------|---------|------|
| [Cloudflare](https://dash.cloudflare.com/) | Workers & Pages → `synsk-me` | 配信、ビルド設定、デプロイの履歴 |
| [Google アナリティクス](https://analytics.google.com/) | プロパティ `synsk.me` | アクセスの確認 |
| [Google タグ マネージャー](https://tagmanager.google.com/) | コンテナ `GTM-5C664DPR` | タグとトリガーの設定 |

## 環境変数

手元で使う値は `.env.local` に置く（git が追跡しない）。要る変数と用途は
`.env.example` が持つ。デプロイを GitHub Actions へ移すときは、CI 用のトークンを別に作る。

Cloudflare の資格情報の名前は `synsk.me - <呼び出し元>: <用途> (<環境>)` とする。環境は
`production`（`main`）か `preview`（`main` 以外のブランチ）で、両方に使うものには付けない。
名前と権限は `.env.example` のコメントが持つ。手元に置かない
`synsk.me - Workers Builds: deploy (production)` は、Workers Builds が `main` をデプロイするときに使う。

ビルドのときに決まる変数が3つある。どれも `.env.local` には書かない。

**`WORKERS_CI_BRANCH`** は、Workers Builds が渡すブランチ名。`next.config.js` がこれを
見て、`main` なら本番、それ以外はプレビューと判定し、結果を `NEXT_PUBLIC_DEPLOY_ENV`
として画面へ渡す。

**`SITE_ORIGIN`** は、カードの画像などの絶対 URL の origin（`src/app/layout.tsx` の `metadataBase`）。`next.config.js` が決める。Workers Builds のビルド（本番とプレビュー）は `https://synsk.me` にする。プレビューの URL はビルドに渡る値から作れないため、プレビューのカードの画像の URL も本番の origin を指す。手元のビルドは、渡せばその値、渡さないか空なら `https://synsk.me` にする。origin 以外（パスなど）を渡すとビルドが止まる。

**`NEXT_PUBLIC_GA_MEASUREMENT_ID`** は、訪問者の数を Google アナリティクスで測るための
Google タグ マネージャーのコンテナ ID。値は `.env`（git が追跡する）にある。画面に
埋め込むのは本番の配信だけとする。プレビューにも埋め込むと、本番の訪問者の数に、
自分がプレビューを見た分が混ざる。

## Worker の secret

`ACCESS_` で始まる 3 つは、`/dash` の画面と書き込みの操作が、Cloudflare Access の JWT を検証するのに使う。どれかが欠けると、オーナーであることを確かめられないとして拒む。`npm run dev` のときだけ、JWT を検証せずにオーナーとして扱い、3 つが欠けていても拒まない。分岐は `npm run build` で消えるため、`npm run preview` では検証する（[ADR-0049](./docs/decisions/0049-verify-access-jwt-except-dev.md)）。本番の値は `npx wrangler secret put <変数>` で Worker に置く。このコマンドは新しい版を作ってすぐにデプロイする。ブランチの Preview の値は `npx wrangler preview base-config secret put <変数>` で Preview の base config に置く。base config の変更は、その後に作られる Preview にだけ効く。手元の値はリポジトリ直下の `.dev.vars` に置く。雛形は `.dev.vars.example`。

| 変数 | 用途 |
|------|------|
| `ACCESS_ISSUER` | Access の team domain（`https://<team-name>.cloudflareaccess.com`）。公開鍵を `<ACCESS_ISSUER>/cdn-cgi/access/certs` から取る |
| `ACCESS_AUD` | Access のアプリケーションの AUD タグ。カンマで区切って複数並べられる。本番には `synsk.me dash`、Preview には `synsk.me preview` の AUD を置く |
| `ACCESS_OWNER_EMAIL` | オーナーとして認めるメールアドレス |
| `RESUME_EMAIL` | 職務経歴書のプロフィールに出すメールアドレス。空か無ければ出さない |

## Workers Builds のビルド構成

リポジトリから読めない。Cloudflare のダッシュボードと API が持つ。trigger は本番の 1 つだけで、ダッシュボードと API のどちらでも編集できる。`main` 以外のブランチは trigger ではなく Worker Previews でビルドする。その Preview command はダッシュボードが持ち、Builds API の triggers には現れない。

| 配信 | build | deploy / Preview command | 対象ブランチ |
|---|---|---|---|
| 本番 | `npm run build` | `npm run deploy` | `main` |
| Preview | `npm run build` | `npm run preview:branch` | `main` 以外 |

値を書き写さず npm の script を呼ぶ形にしてある。コマンドの正本は `package.json` が持つ。

本番の trigger の確認と変更は、Builds API でも行える。`CLOUDFLARE_BUILDS_API_TOKEN` が要る。

```
GET   /client/v4/accounts/{account_id}/builds/workers/{worker_tag}/triggers
PATCH /client/v4/accounts/{account_id}/builds/triggers/{trigger_uuid}
```
