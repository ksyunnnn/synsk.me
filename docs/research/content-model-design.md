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

  // 手動付与メタ
  isFeatured?: boolean;
  tags?: string[];      // 内部分析・将来の可視化用（訪問者UIには非表示）
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
  | 'sandbox'      // コードサンプル（CodeSandbox, CodePen）
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
  | 'codepen'

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

## 経歴・実績・Activity の関係（決定済み）

### 設計方針: C（分離モデル）

3つのエンティティを分離し、**Activity → Project → Career** の参照方向で設計する。

```
Career（職歴）
  ↑ career_id
Project（実績）
  ↑ project_id
Activity（成果物）
```

### 決定の経緯

| 検討したモデル | 説明 | 採否 |
|---------------|------|------|
| A. 参照モデル | Project が Activity を参照（relatedActivityIds） | ❌ クエリが複雑 |
| B. 統合モデル | Project も Activity の一種（type="project"） | ❌ 型安全性が低い |
| **C. 分離モデル** | Activity が Project を参照（project_id） | ✅ 採用 |

### 採用理由

1. **型安全性**: 各エンティティの属性が明示的に定義される
2. **クエリのシンプルさ**: 単純な JOIN で取得可能
3. **職務経歴書出力に適している**: Career → Project → Activity の階層が自然
4. **原則との整合**: 「余白 over 完成形」— 後から構造を変えやすい

### 表示方法

- **デフォルト**: フラット表示（時系列で Activity を並べる）
- **Project の表現**: ラベル/タグとして表示（クリックで詳細）
- **Project 自体はタイムラインに表示しない**（Activity のみ）

### 3エンティティの役割

| エンティティ | 役割 | 例 |
|-------------|------|-----|
| **Career** | 「どこで働いたか」 | 独立/フリーランス (2023/10〜現在) |
| **Project** | 「何を作ったか」 | 地域空き家推定システム |
| **Activity** | 「成果物/証拠」 | GitHub リポジトリ、Zenn 記事 |

### データ構造

```typescript
// 経歴
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

// 実績（プロジェクト）
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
  highlights?: string[];  // ポイント（箇条書き）
  skills?: string[];
  url?: string;
  isHighlighted?: boolean;
}

// Activity（従来の定義 + project_id を追加）
interface Activity {
  id: string;
  projectId?: string;  // Project への参照（nullable: 独立した Activity）

  // ... 既存の属性は変更なし
  type: ActivityType;
  title: string;
  url: string;
  publishedAt: Date;
  // ...
}
```

### DuckDB での実装（次のステップ）

```sql
-- Career テーブル
CREATE TABLE career (
  id VARCHAR PRIMARY KEY,
  company VARCHAR NOT NULL,
  employment_type VARCHAR,
  role VARCHAR,
  start_date DATE,
  end_date DATE,
  description TEXT,
  skills VARCHAR[],
  url VARCHAR
);

-- Project テーブル
CREATE TABLE project (
  id VARCHAR PRIMARY KEY,
  career_id VARCHAR REFERENCES career(id),
  title VARCHAR NOT NULL,
  client VARCHAR,
  client_public VARCHAR,
  role VARCHAR,
  start_date DATE,
  end_date DATE,
  description TEXT,
  highlights VARCHAR[],
  skills VARCHAR[],
  url VARCHAR,
  is_highlighted BOOLEAN DEFAULT false
);

-- Activity テーブル
CREATE TABLE activity (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR REFERENCES project(id),
  type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  url VARCHAR,
  published_at DATE,
  description TEXT,
  display_category VARCHAR,
  tags VARCHAR[],           -- 内部分析・将来の可視化用
  metadata JSON,
  fetched_at TIMESTAMP,
  fetch_status VARCHAR
);
```

### 関連データ

- [resume-raw.md](../../raw_data/resume-raw.md) - 職務経歴データ（非公開、raw_data/）

---

## 決定済み事項

### データモデル

- **C（分離モデル）** を採用: Career + Project + Activity の3テーブル構成
- 参照方向: Activity → Project → Career
- DB: DuckDB

### 表示方法

- フラット表示（時系列）をデフォルト
- Project はラベル/タグとして表現
- 「対話 over 展示」原則に基づき、訪問者が探索する余地を残す

### Timeline デザイン（決定済み）

**Timeline B: Verb + Platform** を採用。

**表示形式**: `{Verb} {Type} on {Platform} · {Time}`

| ActivityType | 動詞 | 例 |
|--------------|------|-----|
| article | Published | `Published an article on Zenn · 5 days ago` |
| repository | Published | `Published a project on GitHub · 1 week ago` |
| event | Hosted / Spoke at / Joined | `Hosted an event on Connpass · 01-15` |
| talk | Gave | `Gave a talk on SpeakerDeck · 2025-12-02` |
| sandbox | Shared | `Shared a sandbox on CodeSandbox` / `Shared a pen on CodePen` |
| playlist | Shared | `Shared a playlist on Spotify` |
| post | Posted | `Posted on Twitter · 2 hours ago` |
| note (internal) | Wrote | `Wrote a note · 3 days ago` |

**動詞の設計方針**: 自然な表現（方針C）
- 「対話 over 展示」: 訪問者に語りかける自然な言葉遣い
- 「息づき over 装飾」: 文脈ごとに最適な動詞を選ぶ
- 機械的な統一より、人間らしい表現を優先

**event の役割分け**:
| 役割 | 動詞 | 用途 |
|------|------|------|
| 主催 | Hosted | 自分が主催したイベント |
| 登壇 | Spoke at | イベント内で登壇した場合 |
| 参加 | Joined | 参加者として出席 |

**時間表示ルール**:
- 1ヶ月未満: 相対時間（`5 days ago`, `2 weeks ago`）
- 1ヶ月以上 & 同年: MM-DD（`01-02`）
- 1ヶ月以上 & 別年: YYYY-MM-DD（`2025-12-02`）

**年グルーピング**: 年ラベル（`2026`, `2025`）でセクション分け

### Platform アイコン（決定済み）

**方針**: Platform アイコン優先、なければフォールバック

| Platform | アイコンソース | 備考 |
|----------|---------------|------|
| GitHub | Simple Icons | ✓ |
| Zenn | Simple Icons | ✓ |
| Qiita | Simple Icons | ✓ |
| dev.to | Simple Icons | ✓ |
| Medium | Simple Icons | ✓ |
| SpeakerDeck | Simple Icons | ✓ |
| Spotify | Simple Icons | ✓ |
| X | Simple Icons | ✓ |
| CodeSandbox | Simple Icons | ✓ |
| Connpass | **Fallback** | Simple Icons になし |
| TECHPLAY | **Fallback** | Simple Icons になし |
| CodePen | **Fallback** | 公式ロゴ取得困難 |
| internal | なし | Platform 表示なし |

**フォールバックアイコン**: `Planet` (Phosphor Icons) ※実装時に取得
- 「未知のプラットフォーム」を示唆するユーモア
- 「おもしろさ over 安全圏」原則に沿う
- Pencil での表示は保留（実装時に Phosphor から直接使用）

**UIアイコンライブラリ**: Phosphor Icons に統一
- 既存コードで使用中（追加コストなし）
- ウェイト（Light/Regular等）は実装時に検討

### 公開設定

- 雇用関係のクライアント: 会社名を公開
- 業務委託のクライアント: 業界名でぼかす（`client` vs `clientPublic`）

### 手動タグ（tags）

**決定**: `tags?: string[]` として実装。

**用途**:
- 内部分析・データ可視化用（トピック推移、技術スタック変遷など）
- 訪問者向けUIには**表示しない**（「余白 over 密度」原則）

**分類の役割分担**:

| フィールド | 用途 | 表示 |
|-----------|------|------|
| `displayCategory` | 訪問者向けの表示分類（4種類） | ◯ |
| `tags` | 内部分析・将来の可視化用 | ✕ |

**採用理由**:
- 「対話 over 展示」: 訪問者との対話にはシンプルな分類で十分
- 「余白 over 完成形」: 将来の可視化のための余白としてデータを持つ
- 12年分のコンテンツを俯瞰・分析する「自分自身との対話」を可能にする

---

## 未決定事項

### 手動メタの属性

Activity に付与する手動メタ:
- `isFeatured`: おすすめフラグ → **Project の `isHighlighted` で代替可能か検討**
- `isHidden`: 非表示フラグ
- `sortOrder`: 表示順の制御（必要に応じて）
- ~~`tags`~~: ✅ 決定済み（上記参照）

### Profile 構造

Activity を参照する形でスキル・強みを表現する構造。

### 個人開発・活動の扱い

- 個人開発（D1〜D6）: Project として扱う（career_id = null）
- 活動（A1〜A5）: 別テーブル or Project の一種として扱うか検討

---

## 次回の継続ポイント

1. ~~経歴・実績（Career / Project）の詳細設計~~ ✅ 決定済み
2. DuckDB スキーマの実装（テーブル作成、初期データ投入）
3. 個人開発・活動の扱いを決定
4. Profile 構造の設計
5. 実装の進め方を決定（データ投入 → クエリ検証 → フロントエンド）

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
*更新日: 2026-02-02*
*ステータス: データモデル決定済み、Timeline デザイン決定済み、tags 設計決定済み、Platform アイコン決定済み、DuckDB スキーマ実装待ち*
