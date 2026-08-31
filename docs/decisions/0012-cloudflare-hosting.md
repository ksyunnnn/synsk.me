---
status: accepted
date: 2026-08-27
decision-makers: synsk
---

# ホスティングに Cloudflare を採用する

## Context and Problem Statement

synsk.me は Vercel 上で動いていた。記事を書く仕組みを持たない、静的なサイトだった。

2026-08-26 に、記事をブラウザ上の管理画面で書き、公開操作の後に別の工程を挟まずに反映する方針を決めた。これによりサーバ側で動く部分が必要になり、静的配信だけでは成立しなくなった。あわせて、画像をテキストとは別の場所に保管する必要も生じた（[ADR-0010](./0010-content-storage-scope.md)）。

歴代サイトを年ごとのサブドメインに置く方針も決めた。本体とは別のプロジェクトとしてデプロイすることになる。

2026年夏に別プロジェクト（meatup）で、Next.js の静的書き出しを Cloudflare Pages に載せ、エッジで画像を生成する構成を組んだ実績がある。ドメインを複数のサブドメインに束ねる運用も行った。

参考にしているサイト（catnose.me）の技術構成と、その作者が公開している記事を調査した。ホスティングとデータの選択が数年で入れ替わる一方、オブジェクトストレージとフレームワークは変わっていないことを確認している。

データと画像の保管に無料枠があり、その範囲で運用を始められることも判断に含めた。

Vercel に留まる選択も成立する。管理画面もサーバ側の処理も動く。両者を比較検討した記録はなく、Cloudflare を選んだのは作り手の意向による。

## Decision Drivers

* [おもしろさ over 安全圏](../PRINCIPLES.md#3-おもしろさ)

## Considered Options

* Vercel に留まる
* Cloudflare

## Decision Outcome

**synsk.me を Cloudflare 上で動かす。画像は Cloudflare R2 に置く。**

### Consequences

* Good, because 記事を書く仕組みに必要なもの（データの置き場、画像の置き場、認証）が同じ場所で揃う
* Good, because 画像の転送量に課金が発生しない
* Good, because 歴代サイトのサブドメインを、同じ場所でプロジェクトごとに分けて運用できる
* Bad, because Next.js をアダプタ（`@opennextjs/cloudflare`）を介して動かすことになり、Next.js 本体の変更への追随が一段遅れる
* Bad, because Vercel 上の既存サイトを移す作業が発生する
* Bad, because **依存先が1社に集中する。** サイトの配信、データ、画像、認証がすべて同じ会社の提供による。無料枠の廃止や仕様変更が起きた場合、影響が同時に及ぶ。同種の事例として、PlanetScale は 2024-04-08 に無料プランを廃止している（[Deprecating the Hobby plan](https://planetscale.com/changelog/deprecating-hobby)）

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: Vercel に留まる

- **Pros**: 既に動いている。移行の作業が発生しない。Next.js の開発元が運用しており、機能の対応が最も早い
- **Cons**: 画像とデータの保管を別のサービスから調達することになる

退けた理由は、比較の結果ではなく作り手の意向による。

### Option B: Cloudflare — 採用

- **Pros**: データ、画像、認証が同じ場所で揃う。R2 は転送量が無料。別プロジェクトで構成の実績がある
- **Cons**: 依存先が1社に集中する。Next.js の対応はアダプタ（`@opennextjs/cloudflare`）を介する

## References

- [ADR-0010: internal コンテンツの正本を synsk.me が持つ](./0010-content-storage-scope.md)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [@opennextjs/cloudflare](https://opennext.js.org/cloudflare)
