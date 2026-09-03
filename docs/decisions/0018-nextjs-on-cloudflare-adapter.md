---
status: accepted
date: 2026-09-03
decision-makers: synsk
---

# Next.js を Cloudflare で動かす方式に @opennextjs/cloudflare を採る

## Context and Problem Statement

[ADR-0012](./0012-cloudflare-hosting.md) は synsk.me を Cloudflare 上で動かすと決めたが、どの方式で動かすかは Consequences で `@opennextjs/cloudflare` に触れるにとどまり、決定として記録していない。方式は代替案を退ける判断であり、記録の対象にあたる。

Cloudflare の公式は別の方式を既定として推奨している。

> "Cloudflare recommends [vinext] as the default way to run Next.js applications on Cloudflare Workers."

ただし同じページが成熟度に条件を付けている。

> "vinext is in beta. Before adopting it for an existing production application, run the compatibility check from your project directory and review the vinext compatibility dashboard."

同ページの別の方式を説明する表は、`@opennextjs/cloudflare` をこう位置づけている。

> "You maintain an existing OpenNext application that cannot yet migrate to vinext because of a compatibility gap."

`@opennextjs/cloudflare` の公式はサポート範囲をこう定める。

> "All minor and patch versions of Next.js 16 and the latest minors of Next.js 14 and 15 are supported. Next.js 14 support will be dropped Q1 2026."

同ページは未対応の機能も挙げている。

> "Node Middleware introduced in 15.2 are not yet supported"

2026-09-03 に、Next.js 16.3.4 と `@opennextjs/cloudflare` 1.20.6 の組み合わせで実測した。`npx opennextjs-cloudflare build` が `.open-next/worker.js` を生成し、`npx wrangler dev` で `/` と `/archives/2024` がいずれも 200 を返す。

同日 `npx vinext check` を実行した。全体で 77% compatible と報告されたが、検出された 3 件の問題のうち 2 件は `.open-next/` と `.wrangler/` 配下のビルド生成物に対する指摘であり、`src/` 配下に対する指摘はない。残る 1 件は `package.json` に `"type": "module"` が無いことで、`vinext init` が自動で足すと報告されている。`next/font/google` が partial support（フォントをビルド時に自ホストせず CDN から読む）と報告された。

移行にあたって捨てるものは少ない。`src/` に Cloudflare の binding を触るコードは存在せず（`getCloudflareContext` と `env.DB` の検索が 0 件）、`open-next.config.ts` は 12 行、`next.config.js` の Cloudflare 依存は `initOpenNextCloudflareForDev` の呼び出しだけである。一方で変わるものは大きい。ビルドツールチェーンが Vite に、デプロイの命令が変わり、binding へのアクセス経路が変わり、Workers Builds のダッシュボード設定も書き換えが要る。

## Decision Drivers

* 実験 over 完璧な計画（[PRINCIPLES.md](../PRINCIPLES.md#2-実験)）

## Considered Options

* `@opennextjs/cloudflare`
* `vinext`
* `@cloudflare/next-on-pages`

## Decision Outcome

**Next.js を Cloudflare で動かす方式に `@opennextjs/cloudflare` を採る。**

Cloudflare が既定として推奨する `vinext` を採らない理由は、公式が beta と明示し、本番のアプリケーションへ適用する前に互換性チェックを求めているため。`@opennextjs/cloudflare` は Next.js 16 の全マイナー・パッチを公式にサポートし、synsk.me で実際にビルドと配信が通っている。

### Consequences

* Good, because Next.js 16 の全マイナー・パッチが公式のサポート範囲に入る
* Good, because 移行に伴う検証をしない。ビルドツールチェーンとデプロイの命令が変わらない
* Bad, because **Cloudflare が推奨する既定の経路から外れる。** 公式の表は `@opennextjs/cloudflare` を「互換性の隙間があって vinext へ移れない既存アプリ」の選択肢として説明する。synsk.me はその隙間を持たない
* Bad, because Node Middleware（Next.js 15.2 で導入）が使えない
* Bad, because `vinext` が beta を抜けた時点で、この決定を問い直すことになる

### Confirmation

`npx opennextjs-cloudflare build` が成功し、`npx wrangler dev` で訪問者が到達する経路が 200 を返すこと。この検査を自動で回す仕組みは持たない（#56 が扱う）。

## Pros and Cons of the Options

### `@opennextjs/cloudflare` — 採用

* Good, because Next.js 16 の全マイナー・パッチをサポートする
* Good, because synsk.me で動いている
* Neutral, because Cloudflare の公式は推奨せず、移行できない場合の選択肢として説明する
* Bad, because Node Middleware に未対応

### `vinext`

* Good, because Cloudflare が Workers 向けの既定として推奨する
* Good, because `vinext init` が非破壊で、`next dev` を残す
* Bad, because beta である。公式が本番適用の前に互換性チェックを求める
* Bad, because ビルドツールチェーンが Vite に変わり、デプロイと binding のアクセス経路も変わる

### `@cloudflare/next-on-pages`

* Bad, because Cloudflare Pages 向けである。Cloudflare は Next.js の配信先として Workers を推奨する

## More Information

- [ADR-0012: ホスティングに Cloudflare を採用する](./0012-cloudflare-hosting.md)
- [Next.js · Cloudflare Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [@opennextjs/cloudflare](https://opennext.js.org/cloudflare)
- [vinext](https://vinext.dev/)
