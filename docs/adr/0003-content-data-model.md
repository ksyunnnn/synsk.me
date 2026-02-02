# ADR-0003: コンテンツデータモデル設計（C: 分離モデル）

- **Status**: accepted
- **Date**: 2026-02-02
- **Deciders**: shunsuke
- **Related Principles**: [余白 over 完成形](../PRINCIPLES.md#1-余白), [対話 over 展示](../PRINCIPLES.md#3-対話)

---

## Context

synsk.me のリデザインにおいて、以下のデータを適切に管理する必要がある：

1. **Activity**: 外部プラットフォームから取得するコンテンツ（GitHub リポジトリ、Zenn 記事、イベント参加など）
2. **Project（実績）**: 業務や個人開発で作成したプロダクト
3. **Career（経歴）**: 職歴情報

これらの関係をどうモデリングするかが課題となった。

### 要件

- 職務経歴書の出力に適した構造
- 訪問者向けのタイムライン表示
- Activity と Project の関係性を表現
- 型安全なデータ操作
- DuckDB での実装を想定

---

## Decision

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

- 雇用関係のクライアント: 会社名を公開
- 業務委託のクライアント: 業界名でぼかす（`client` vs `clientPublic`）

---

## Alternatives Considered

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

---

## Consequences

### Positive

- **型安全性**: 各エンティティの属性が明示的に定義される
- **クエリのシンプルさ**: 単純な JOIN で関連データを取得可能
- **職務経歴書出力に最適**: Career → Project → Activity の階層が自然
- **柔軟性**: Activity は Project に属さない独立したものも許容（`projectId: null`）

### Negative

- **3テーブル管理**: テーブル数が増える
- **手動入力の負担**: Project と Career は基本的に手動入力

### Risks

- Project の数が増えた場合、管理が煩雑になる可能性
  - **対策**: isHighlighted フラグでハイライト表示を制御

---

## Implementation Notes

### TypeScript 型定義

```typescript
interface Career {
  id: string;
  company: string;
  employmentType: 'employee' | 'freelance' | 'intern';
  role: string;
  startDate: Date;
  endDate?: Date;  // null = 現在
  description?: string;
  skills?: string[];
  url?: string;
}

interface Project {
  id: string;
  careerId?: string;  // Career への参照（nullable: 個人開発など）
  title: string;
  client?: string;        // 元のクライアント名（非公開）
  clientPublic?: string;  // 公開用の名前（業界名でぼかす）
  role: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
  highlights?: string[];
  skills?: string[];
  url?: string;
  isHighlighted?: boolean;
}

interface Activity {
  id: string;
  projectId?: string;  // Project への参照（nullable）
  type: ActivityType;
  title: string;
  url: string;
  publishedAt: Date;
  // ... 他の属性は content-model-design.md 参照
}
```

### DuckDB スキーマ

詳細は [content-model-design.md](../research/content-model-design.md) を参照。

---

## References

- [Content Model 設計](../research/content-model-design.md) - 詳細なデータ構造定義
- [Hub-and-Spoke モデル](../research/hub-and-spoke-model.md) - データ取得アーキテクチャ
- [ADR-0002: Hub-and-Spoke データアーキテクチャ](./0002-hub-and-spoke-data-architecture.md)
