---
status: accepted
date: 2026-02-02
decision-makers: synsk
---

# コンテンツデータモデル設計（C: 分離モデル）

## Context and Problem Statement

synsk.me のリデザインにおいて、以下のデータを適切に管理する必要がある：

1. **Activity**: 外部プラットフォームから取得するコンテンツ（GitHub リポジトリ、Zenn 記事、イベント参加など）
2. **Project（実績）**: 業務や個人開発で作成したプロダクト
3. **Career（経歴）**: 職歴情報

これらの関係をどうモデリングするかが課題となった。

## Decision Drivers

* [余白 over 完成形](../PRINCIPLES.md#1-余白)
* [対話 over 展示](../PRINCIPLES.md#3-対話)

## Considered Options

* 参照モデル（Project → Activity）
* 統合モデル（Project as Activity）

## Decision Outcome

**Career + Project + Activity の3テーブル構成で、Activity → Project → Career の参照方向で設計する（C: 分離モデル）。**

```
Career（職歴）
  ↑ career_id
Project（実績）
  ↑ project_id
Activity（成果物）
```

### 表示方法

- **デフォルト**: フラット表示（時系列で Activity を並べる）
- **Project の表現**: ラベル/タグとして表示（クリックで詳細）
- **Project 自体はタイムラインに表示しない**（Activity のみ）

### 公開設定

> **分離の記録（2026-08-21）**: 本 ADR は当初「3テーブル構成の採用」と「公開設定」という
> 2つの決定を含んでいたが、[docs/adr/README.md](./README.md) が定める ADR の単位に
> 反していたため、可視性の決定を [ADR-0008](./0008-content-visibility.md) へ分離した。
> 以下は分離前の記録である。

- 雇用関係のクライアント: 会社名を公開
- 業務委託のクライアント: 業界名でぼかす（`client` vs `clientPublic`）

### Consequences

* Good, because **型安全性**: 各エンティティの属性が明示的に定義される
* Good, because **クエリのシンプルさ**: 単純な JOIN で関連データを取得可能
* Good, because **職務経歴書出力に最適**: Career → Project → Activity の階層が自然
* Good, because **柔軟性**: Activity は Project に属さない独立したものも許容（`projectId: null`）
* Bad, because **3テーブル管理**: テーブル数が増える
* Bad, because **手動入力の負担**: Project と Career は基本的に手動入力
* Bad, because Project の数が増えた場合、管理が煩雑になる可能性
  * **対策**: isHighlighted フラグでハイライト表示を制御

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: 参照モデル（Project → Activity）

Project が Activity を参照する方式（`relatedActivityIds: string[]`）。

- **Pros**: Project 中心の管理がしやすい
- **Cons**:
  - 「この Activity はどの Project に属するか」のクエリが JOIN 複数回必要
  - 配列フィールドの検索が非効率

### Option B: 統合モデル（Project as Activity）

Project を Activity の一種として扱う（`type: 'project'`）。

- **Pros**:
  - シンプルな単一テーブル設計
  - タイムライン表示が容易
- **Cons**:
  - Project 固有の属性（highlights, client, clientPublic）が型安全でない
  - 外部取得 Activity と手動作成 Project の性質が異なる
  - Discriminated Union が複雑化

## More Information

- [Content Model 設計](../archive/content-model-design.md) - 詳細なデータ構造定義
- [Hub-and-Spoke モデル](../archive/hub-and-spoke-model.md) - データ取得アーキテクチャ
- [ADR-0002: Hub-and-Spoke データアーキテクチャ](./0002-hub-and-spoke-data-architecture.md)
