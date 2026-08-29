---
status: accepted
date: 2026-08-21
decision-makers: synsk
---

# internal コンテンツの正本を synsk.me が持つ

## Context and Problem Statement

[ADR-0006](./0006-posse-publishing-strategy.md) は POSSE を採用し、synsk.me を正本として外部プラットフォームへ転載すると決めた。正本を持つということは、本文そのものを保管するということである。

外部から取得する activity はタイトルと URL を持てば足りる。本文は外部にある。internal のコンテンツはこれと性質が異なり、保管する対象が増える。

- 本文
- 記事に含める画像などのメディア
- 書き直したときの過去の版

2026-08-21 の検討で、版を保持する必要があることを確認した。書き直して内容が変わったとき、前の版に戻せる必要がある。

## Decision Drivers

* [実験 over 完璧な計画](../PRINCIPLES.md#2-実験)

## Considered Options

* 本文を外部プラットフォームに置き、synsk.me は参照だけ持つ
* 最新版だけを保管する
* 本文・メディア・過去の版を保管する

## Decision Outcome

**internal コンテンツの本文・メディア・過去の版を synsk.me が保管する。**

保管の物理的な形式と置き場所は本 ADR では扱わない。

### Consequences

* Good, because 外部プラットフォームが終了しても、書いたものが残る
* Good, because 公開後に書き直しても、前の版に戻せる
* Bad, because 版の保持方式を設計する必要がある。既存サービス（Zenn、dev.to）の挙動が参考になる
* Bad, because メディアファイルの保管が、テキストとは別の仕組みを要求する
* Bad, because **版の粒度を決めていない。** 保存のたびに版を作るのか、公開のたびに作るのかで、保管量が桁違いになる

## Pros and Cons of the Options

### Option A: 本文を外部プラットフォームに置き、synsk.me は参照だけ持つ

Medium や Zenn に書いて、synsk.me からリンクする。

- **Pros**: 保管する対象が外部 activity と同じになり、扱いが単純になる
- **Cons**: [ADR-0006](./0006-posse-publishing-strategy.md) の POSSE と矛盾する。正本が外部に移る

### Option B: 最新版だけを保管する

- **Pros**: 保管量が最小。設計が単純
- **Cons**: 書き直して内容が変わったとき、前の版に戻せない

### Option C: 本文・メディア・過去の版を保管する — 採用

- **Pros**: POSSE が成立する。書き直しを恐れずに公開できる
- **Cons**: 保管量が増える。版を管理する設計が要る

## References

- [ADR-0006: 発信戦略として POSSE を採用する](./0006-posse-publishing-strategy.md)
- [ADR-0009: 外部データを永続化し、手で付けた情報を再取得後も保持する](./0009-external-data-sync.md)
