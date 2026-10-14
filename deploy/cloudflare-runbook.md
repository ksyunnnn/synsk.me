# サブドメインの接続手順

[routing.md](./routing.md) の割り当てを Cloudflare 上で実現する手順。対象はサブドメインに出すすべてのサイト。

## 配信の形

サブドメインのサイトは Cloudflare Workers で配信する。静的なファイルだけのサイトは、Worker のコード（`main`）を持たない静的アセットだけの Worker にする。

## 設定ファイル

`wrangler.jsonc` に、名前・カスタムドメイン・404 の扱いを書く。

```jsonc
{
  "name": "synsk-me-<名前>",
  "compatibility_date": "<日付>",
  "assets": { "not_found_handling": "404-page" },
  "routes": [{ "pattern": "<サブドメイン>.synsk.me", "custom_domain": true }],
  "workers_dev": false,
}
```

- 設定を足せるサイトは、そのサイトのリポジトリに置く
- 凍結した過去の版のように設定を足せないサイトは、このリポジトリの `deploy/<ドメイン>/wrangler.jsonc` に置く

## デプロイ

```bash
npx wrangler deploy --config <設定ファイル> --assets <配信するフォルダ>
```

カスタムドメインの DNS レコードと証明書は、デプロイのときに Cloudflare が作る。そのホスト名に CNAME レコードが既にあると作れない（[Cloudflare: Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)）。
