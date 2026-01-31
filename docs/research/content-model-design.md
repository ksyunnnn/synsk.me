# Content Model 設計

> synsk.me のコンテンツデータ構造の設計ドキュメント

---

## 概要

Content Modeling の方法論に基づき、synsk.me のデータ構造を設計する。

### 設計方針

- **Bottom-up + Hybrid アプローチ**: データソースの特性を理解した上で構造を設計
- **2層構造**: データ層（ActivityType）と表示層（DisplayCategory）を分離
- **取得失敗への対応**: 全フィールドをオプショナルに、fetchStatus で状態管理

### 関連ドキュメント

- [hub-and-spoke-model.md](./hub-and-spoke-model.md) - データ取得アーキテクチャ
- [content-classification-report.md](./content-classification-report.md) - コンテンツの棚卸し

---

## Activity 型

### 基本構造

```typescript
interface Activity {
  // 識別子
  id: string;

  // 基本属性（全プラットフォーム共通）
  type: ActivityType;
  title: string;
  url: string;
  publishedAt: Date;
  description?: string;

  // プラットフォーム固有データ
  metadata: PlatformMetadata;

  // 表示カテゴリ（デフォルト自動設定、手動上書き可能）
  displayCategory: DisplayCategory;

  // 手動付与メタ（TODO: 詳細設計）
  isFeatured?: boolean;
  category?: string;
  comment?: string;

  // 取得ステータス
  fetchedAt: Date;
  fetchStatus: 'success' | 'partial' | 'failed';
}
```

---

## ActivityType

コンテンツの「構造」を決める型。

```typescript
type ActivityType =
  | 'article'      // 記事（Zenn, Qiita, dev.to, Medium, 内部notes）
  | 'repository'   // リポジトリ（GitHub）
  | 'event'        // イベント（connpass, TECHPLAY）
  | 'talk'         // 登壇（Speaker Deck）
  | 'sandbox'      // コードサンプル（Codesandbox）
  | 'post'         // SNS投稿（Twitter）
  | 'playlist'     // プレイリスト（Spotify）
  | 'misc';        // その他
```

---

## Platform

データの取得元。

```typescript
type Platform =
  // 自動取得可能
  | 'github'
  | 'zenn'
  | 'qiita'
  | 'devto'
  | 'connpass'
  | 'medium'
  | 'spotify'
  | 'twitter'

  // 手動 or 制限あり
  | 'speakerdeck'
  | 'techplay'
  | 'codesandbox'

  // サイト固有
  | 'internal';
```

---

## DisplayCategory

訪問者向けの「見せ方」を決める分類。

```typescript
type DisplayCategory =
  | 'works'      // 作ったもの（repository, sandbox, プロダクト）
  | 'writing'    // 記事、notes、思考
  | 'activity'   // イベント参加、登壇
  | 'misc';      // その他（プレイリスト、受賞など）
```

### デフォルトマッピング

| ActivityType | Platform | デフォルト DisplayCategory |
|--------------|----------|---------------------------|
| `repository` | github | `works` |
| `sandbox` | codesandbox | `works` |
| `article` | zenn, qiita, devto, medium, internal | `writing` |
| `post` | twitter | `writing` |
| `event` | connpass, techplay | `activity` |
| `talk` | speakerdeck | `activity` |
| `playlist` | spotify | `misc` |
| `misc` | any | `misc` |

### 手動上書き

DisplayCategory は手動で上書き可能。

**例**:
- 内部notesでリリース記事を書いた → `article` + `works`
- Twitter投稿だが思考系 → `post` + `writing`

---

## PlatformMetadata

プラットフォームごとの固有データ。Discriminated Union で定義。

すべてのフィールドはオプショナル（取得失敗を考慮）。

```typescript
interface GitHubMetadata {
  platform: 'github';
  stars?: number;
  forks?: number;
  language?: string;
  isArchived?: boolean;
  topics?: string[];
}

interface ZennMetadata {
  platform: 'zenn';
  // RSS から取得可能なのは基本属性のみ
}

interface QiitaMetadata {
  platform: 'qiita';
  tags?: string[];
  likesCount?: number;
  stocksCount?: number;
}

interface DevtoMetadata {
  platform: 'devto';
  reactionsCount?: number;
  commentsCount?: number;
  tags?: string[];
}

interface ConnpassMetadata {
  platform: 'connpass';
  eventDate?: Date;
  participants?: number;
  limit?: number;
  venue?: string;
  isOnline?: boolean;
}

interface MediumMetadata {
  platform: 'medium';
  // RSS のみ、更新停止
}

interface SpeakerDeckMetadata {
  platform: 'speakerdeck';
  slideCount?: number;
  eventName?: string;
}

interface TechplayMetadata {
  platform: 'techplay';
  eventDate?: Date;
  participants?: number;
  role?: 'organizer' | 'speaker' | 'participant';
}

interface CodesandboxMetadata {
  platform: 'codesandbox';
  viewCount?: number;
  forkCount?: number;
  template?: string;
}

interface SpotifyMetadata {
  platform: 'spotify';
  trackCount?: number;
  followerCount?: number;
  isPublic?: boolean;
  collaborative?: boolean;
}

interface TwitterMetadata {
  platform: 'twitter';
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
}

interface InternalMetadata {
  platform: 'internal';
  // サイト固有コンテンツ、手動入力
}

type PlatformMetadata =
  | GitHubMetadata
  | ZennMetadata
  | QiitaMetadata
  | DevtoMetadata
  | ConnpassMetadata
  | MediumMetadata
  | SpeakerDeckMetadata
  | TechplayMetadata
  | CodesandboxMetadata
  | SpotifyMetadata
  | TwitterMetadata
  | InternalMetadata;
```

---

## 経歴と実績

Activity とは別のデータ構造として扱う。

### 経歴と実績の違い

| 観点 | 経歴（Career） | 実績（Achievement） |
|------|---------------|-------------------|
| **性質** | 「どこで働いたか」 | 「何を作ったか/貢献したか」 |
| **内容** | 会社名、期間、役職 | プロジェクト名、成果、技術 |
| **関係** | 「箱」 | 「中身」 |
| **更新頻度** | 転職時のみ | プロジェクト完了ごと |
| **Activity との関係** | 直接関係なし | Activity が証拠となる |

### データ構造案（TODO: 詳細設計）

```typescript
// 経歴
interface Career {
  id: string;
  company: string;
  role: string;
  startDate: Date;
  endDate?: Date;  // null = 現在
  description?: string;
  url?: string;
}

// 実績
interface Achievement {
  id: string;
  title: string;
  description: string;
  date: Date;
  careerId?: string;  // 経歴への参照
  skills?: string[];
  url?: string;
  relatedActivityIds?: string[];  // Activity への参照
}
```

---

## 未決定事項

### 手動メタの属性

現在の案:
- `isFeatured`: おすすめフラグ
- `category`: 任意のカテゴリ
- `comment`: ハイライトコメント

追加検討:
- `sortOrder`: 表示順の制御
- `isHidden`: 非表示フラグ
- `relatedIds`: 関連コンテンツへの参照

### Profile 構造

Activity を参照する形でスキル・強みを表現する構造。

### DuckDB スキーマ

テーブル設計の詳細。

---

## 次回の継続ポイント

1. 手動メタの属性を決定
2. 経歴・実績（Career / Achievement）の詳細設計
3. Profile 構造の設計
4. DuckDB スキーマの設計
5. 実装の進め方を決定

---

## 参考

### Content Modeling 方法論

- [Content Modeling | Contentstack](https://www.contentstack.com/blog/all-about-headless/content-modeling-and-headless-cms)
- [Structured Content 101 | Sanity](https://www.sanity.io/structured-content-101)

### プロジェクト原則との整合

- **「対話 over 展示」**: DisplayCategory は訪問者の関心に基づく分類
- **「余白 over 完成形」**: `misc` カテゴリで想定外のコンテンツに対応
- **「余白 over 密度」**: 4カテゴリでシンプルに保つ

---

*作成日: 2026-01-31*
*ステータス: 設計中*
