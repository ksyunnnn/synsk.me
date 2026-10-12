# 過去の版

過去の版のサイトの決まりごとと、版ごとのビルド手順。サブドメインへの接続は [cloudflare-runbook.md](./cloudflare-runbook.md) にある。

## 決まりごと

- リポジトリは、凍結した時点のコードに「アーカイブ済み」の帯を読み込む commit を 1 つだけ足したものとする
- 帯の読み込み以外で、このリポジトリに依存しない

## アーカイブ済みの帯

過去の版のサイトは、このリポジトリが配信する `https://synsk.me/archive-banner.js` を読み込んで、トップへの入口になる帯を出す。

```html
<script src="https://synsk.me/archive-banner.js" defer></script>
<synsk-archive-banner></synsk-archive-banner>
```

- `integrity` を付けない。帯を直すたびに値が変わり、すべての過去の版のタグを書き換えることになるため（[MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)）
- synsk.me は `public/_headers` で、このファイルにだけ `Access-Control-Allow-Origin: *` を付ける。外から読まれるための公開ファイルであるため。サイト全体には付けない
- 帯の見た目と文言は `public/archive-banner.js` だけが持つ。直せばすべての過去の版に効く
- `public/archive-banner.js` が返ることは `scripts/verify-deploy.mjs` がデプロイのたびに確かめる

## 2024.synsk.me

Next.js 15 のサイトを静的なファイルとして配信する。`/icon` と `/opengraph-image` はサーバーで作る経路のため、静的な配信では動かない。

### ビルド

リポジトリのコードを変えずに、ビルドの出力から静的なファイルを取り出す。Node 22 で確かめた。

```bash
git clone git@github.com:ksyunnnn/2024.synsk.me.git
cd 2024.synsk.me
npm ci
npm run build
mkdir -p out/_next
cp -R .next/static out/_next/static
cp .next/server/app/index.html out/index.html
cp .next/server/app/_not-found.html out/404.html
```

### デプロイ

設定は [2024.synsk.me/wrangler.jsonc](./2024.synsk.me/wrangler.jsonc) にある。このリポジトリの直下で実行する。

```bash
npx wrangler deploy --config deploy/2024.synsk.me/wrangler.jsonc --assets <2024.synsk.me を clone した場所>/out
```
