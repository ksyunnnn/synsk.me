# ADR-0006: 発信戦略として POSSE を採用する

> この文書は決定を記録する。有効な要件は持たない。

- **Status**: accepted
- **Date**: 2026-08-20
- **Deciders**: synsk
- **Related Principles**: [余白 over 密度](../PRINCIPLES.md)

---

## Context

synsk.me の発信は、これまで外部プラットフォーム上でのみ行われてきた。

- Zenn: 25記事（2020-12〜2025-09）。技術記事のみ
- Medium: 23記事（2016-10〜2021-01）。日記・キャリア・コミュニティ・思想。更新停止
- GitHub / Speaker Deck / TECH PLAY / connpass など

この構成では、コンテンツの所有権と永続性が各プラットフォームに依存する。実際に外部プラットフォームが機能を停止する事例は発生しており、たとえば Webmention 中継サービス Bridgy は X（旧 Twitter）・Facebook・Medium のサポートをいずれも終了している（https://brid.gy/about の FAQ 項目「What happened to Twitter? / Facebook? / Medium?」で確認、2026-08-20 時点）。

[ADR-0002](./0002-hub-and-spoke-data-architecture.md) では、外部プラットフォームから synsk.me へコンテンツを集約する Hub-and-Spoke（IndieWeb の分類では PESOS 相当）を採用した。しかし逆方向、つまり synsk.me を起点に発信する場合の指針は決めていなかった。[content-model-design.md](../research/content-model-design.md) の `platform: 'internal'`（サイト固有コンテンツ）は型としては定義済みだが、外部プラットフォームとの関係が未定義だった。

---

## Decision

**synsk.me を正本（canonical）として公開し、外部プラットフォームには複製を流す POSSE（Publish on your Own Site, Syndicate Elsewhere）を採用する。**

外部プラットフォーム上での反応（コメント・いいね）を synsk.me 側へ引き戻す backfeed は採用しない。双方向のコミュニケーションは各プラットフォーム上で完結させる。

この決定は ADR-0002 を置き換えるものではない。外部発のコンテンツを集約する PESOS（ADR-0002）と、自サイト発のコンテンツを配信する POSSE（本 ADR）は併存する。

---

## Alternatives Considered

### Option A: 外部プラットフォームを正本にする（PESOS のみ）

内部コンテンツを持たず、すべて Zenn / Medium 等に書く。

- **Pros**: サイト実装が不要。既存の読者に直接届く
- **Cons**: 所有権と永続性が各プラットフォームに依存する。プラットフォーム終了時にコンテンツを失う

### Option B: POSSE + backfeed

POSSE に加え、[Webmention](https://www.w3.org/TR/webmention/) と [Bridgy](https://brid.gy/) で外部の反応を synsk.me に集約する。

- **Pros**: 反応も含めて自サイトに残る
- **Cons**: Bridgy は X・Facebook・Medium を非対応。synsk.me が主に使うプラットフォームからは反応が届かず、実装しても効果を得られない

### Option C: POSSE（backfeed なし）— 採用

- **Pros**: 所有権と永続性を確保しつつ、実装は転載と canonical 設定のみで済む
- **Cons**: 反応は各プラットフォームに分散したまま残る

---

## Consequences

### Positive

- コンテンツの正本が synsk.me に残り、外部プラットフォームの終了や仕様変更から独立する
- 外部プラットフォームの読者層に届けつつ、導線を synsk.me に集約できる
- [VISION.md](../VISION.md) が定めるコンタクト手段（外部メッセンジャー）と整合する。サイトにコメント欄を持たない前提を維持できる

### Negative

- synsk.me 側に記事を公開する実装（`platform: 'internal'` のコンテンツ配信）が前提になる。実装が完了するまで POSSE は運用できない
- 転載の手間が発生する

### Risks

- 同一コンテンツが synsk.me と転載先の両方に存在するため、Hub-and-Spoke の集約時に重複エントリが発生する。対処は Implementation Notes を参照

---

## Decision の詳細

### 重複エントリの除外

転載した記事は、synsk.me の internal エントリと転載先プラットフォームのエントリとして二重に集約されうる。

外部から判定する方法（転載先の `rel="canonical"` を読んで synsk.me 向きのものを除外する）は採らない。Medium の RSS フィード（https://medium.com/feed/@ksyunnnn）を 2026-08-20 に取得して確認したところ、`item` に含まれるのは `title` / `link` / `guid` / `pubDate` / `category` / `content:encoded` / `dc:creator` のみで canonical は含まれない。判定には記事ページを個別に取得する必要があり、コストと外部 HTML 構造への依存が大きい。

代わりに、internal 側が転載先を保持する。IndieWeb の [u-syndication](https://indieweb.org/u-syndication) に相当する。

```ts
interface InternalMetadata {
  platform: 'internal';
  syndicatedTo?: string[];  // 転載先 URL
}
```

集約時に、internal エントリの `syndicatedTo` に含まれる URL を持つ外部エントリを除外する。

### canonical の設定

- 転載先で `rel="canonical"` を synsk.me に向ける
- Medium は Import a story 機能を使うと canonical が自動設定される
- dev.to は `canonical_url` フィールドを持つ
- Zenn には canonical を指定する機能がない認識だが、未検証（[推測]）

---

## References

- [POSSE — IndieWeb](https://indieweb.org/POSSE)
- [PESOS — IndieWeb](https://indieweb.org/PESOS)
- [backfeed — IndieWeb](https://indieweb.org/backfeed)
- [Webmention — W3C Recommendation](https://www.w3.org/TR/webmention/)
- [Bridgy](https://brid.gy/)
- [ADR-0002: Hub-and-Spoke データアーキテクチャ](./0002-hub-and-spoke-data-architecture.md)
- [ADR-0003: コンテンツデータモデル設計](./0003-content-data-model.md)
