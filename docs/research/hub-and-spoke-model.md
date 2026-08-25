# Hub-and-Spoke モデル設計検討

> この文書は決定の正本ではない。決定は docs/adr/ にある。

> synsk.me をハブ（中心）として、各プラットフォームから最新データを取得・統合するアーキテクチャ

## Contents

- 概要
- プラットフォーム別実装計画
- 統合アーキテクチャ
- 表示形式の検討
- 実装優先度
- 必要な環境変数
- 次のステップ
- 決定事項
- 未解決の検討事項

---

---

## 概要

### モデル構造

```
                         ┌─────────────────┐
                         │    synsk.me     │
                         │     (Hub)       │
                         │    + DuckDB     │
                         └────────┬────────┘
                                  │
     ┌──────────┬─────────┬───────┼───────┬─────────┬──────────┐
     │          │         │       │       │         │          │
┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌─▼─┐ ┌───▼───┐ ┌───▼───┐ ┌───▼────┐
│  Zenn   │ │GitHub │ │Qiita  │ │...│ │Spotify│ │Twitter│ │internal│
│  (RSS)  │ │ (API) │ │ (API) │ │   │ │ (API) │ │(embed)│ │ (手動) │
└─────────┘ └───────┘ └───────┘ └───┘ └───────┘ └───────┘ └────────┘
```

### 設計方針

1. **Webhook 優先**: 対応プラットフォームはリアルタイム連携
2. **レート制限考慮**: API は ISR/Cron で定期取得
3. **静的フォールバック**: API 不可のプラットフォームは手動更新
4. **段階的実装**: 優先度順に統合を進める

---

## プラットフォーム別実装計画

### Tier 1: Webhook + API（リアルタイム統合）

> **注記**: Zenn は GitHub 連携を使用していないため、Webhook 対応は GitHub のみ

#### 1. GitHub

| 項目 | 内容 |
|------|------|
| ユーザー名 | `ksyunnnn` |
| 取得方法 | GitHub REST API / GraphQL API |
| Webhook | ✅ 対応（リポジトリ単位で設定可能） |
| 認証 | Personal Access Token（PAT）推奨 |
| レート制限 | 5,000 req/hour（認証時） |

**取得可能データ**:
- パブリックリポジトリ一覧（名前、説明、スター、言語）
- 最新コミット
- Contribution グラフ（GraphQL）
- リリース情報

**実装例**:
```typescript
// GitHub API での最新リポジトリ取得
const res = await fetch(
  'https://api.github.com/users/ksyunnnn/repos?sort=updated&per_page=5',
  { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
);
```

**Webhook 設定**:
- GitHub Actions で `push` / `release` 時に Vercel デプロイをトリガー
- または GitHub Webhook → synsk.me の API Route → ISR 再検証

---

#### 2. Zenn

| 項目 | 内容 |
|------|------|
| ユーザー名 | `ksyunnnn` |
| 取得方法 | RSS フィード |
| Webhook | ✅ Zenn → GitHub 連携経由で可能 |
| レート制限 | なし（RSS） |

**RSS URL**: `https://zenn.dev/ksyunnnn/feed`

**取得可能データ**:
- 記事タイトル、URL、公開日
- 記事サマリー（description）

**実装例**:
```typescript
import Parser from 'rss-parser';

const parser = new Parser();
const feed = await parser.parseURL('https://zenn.dev/ksyunnnn/feed');
const articles = feed.items.slice(0, 5);
```

**更新戦略**:
- ISR（1日1回程度）で定期取得
- GitHub 連携未使用のため Webhook は不可

---

### Tier 2: API のみ（定期取得）

#### 3. Qiita

| 項目 | 内容 |
|------|------|
| ユーザー名 | `ksyunnnn` |
| 取得方法 | Qiita API v2 |
| Webhook | ❌ 非対応 |
| レート制限 | 1,000 req/hour（認証時） |

**API URL**: `https://qiita.com/api/v2/users/ksyunnnn/items`

**取得可能データ**:
- 記事タイトル、URL、公開日
- タグ、いいね数、ストック数

**実装例**:
```typescript
const res = await fetch(
  'https://qiita.com/api/v2/users/ksyunnnn/items?per_page=5',
  { headers: { Authorization: `Bearer ${process.env.QIITA_TOKEN}` } }
);
```

**更新戦略**: ISR（1日1回）または Cron ジョブ

---

#### 4. dev.to

| 項目 | 内容 |
|------|------|
| ユーザー名 | `ksyunnnn` |
| 取得方法 | dev.to API |
| Webhook | ❌ 非対応（2024年時点） |
| レート制限 | 認証不要、緩やか |

**API URL**: `https://dev.to/api/articles?username=ksyunnnn`

**取得可能データ**:
- 記事タイトル、URL、公開日
- リアクション数、コメント数

**更新戦略**: ISR（1日1回）

---

#### 5. connpass

| 項目 | 内容 |
|------|------|
| 検索対象 | `ksyunnnn` または イベント名 |
| 取得方法 | connpass API |
| Webhook | ❌ 非対応 |
| レート制限 | 不明（過度なアクセス禁止） |

**API URL**: `https://connpass.com/api/v1/event/?keyword=AtomicDesign`

**取得可能データ**:
- イベント名、日時、参加者数
- イベントURL

**更新戦略**: 手動または月次 Cron

---

#### 6. Spotify

| 項目 | 内容 |
|------|------|
| ユーザー名 | `synsk` |
| 取得方法 | Spotify Web API |
| Webhook | ❌ 非対応 |
| レート制限 | あり（認証必須） |

**API エンドポイント**: `https://api.spotify.com/v1/users/{user_id}/playlists`

**取得可能データ**:
- プレイリスト名、URL、説明
- トラック数、フォロワー数
- 公開/非公開フラグ

**更新戦略**: ISR（週1回程度）

**DisplayCategory**: `misc`

---

#### 7. Twitter / X

| 項目 | 内容 |
|------|------|
| ユーザー名 | `@ksyunnnn` |
| 取得方法 | 埋め込み（手動選択） |
| Webhook | ❌ |
| レート制限 | API は有料化のため埋め込みで対応 |

**取得方法**:
- catnose.me 方式: リリース告知などの特定ツイートを手動で選択し埋め込み
- oEmbed API で埋め込みコード取得

**取得可能データ**:
- ツイート本文、URL、投稿日
- いいね数、RT数（埋め込み経由）

**更新戦略**: 手動（重要な投稿のみ選択）

**DisplayCategory**: `writing` または `works`（内容による、手動上書き）

---

### Tier 3: RSS のみ（定期取得）

#### 8. Medium

| 項目 | 内容 |
|------|------|
| ユーザー名 | `@ksyunnnn` |
| 取得方法 | RSS フィード |
| Webhook | ❌ 非対応 |
| 最終更新 | 2021年（アーカイブ扱い） |

**RSS URL**: `https://medium.com/feed/@ksyunnnn`

**更新戦略**: 静的（更新なしのため）

**RSS の制約**（2026-08-20 に実フィードを取得して確認）:

- `item` に含まれるのは `title` / `link` / `guid` / `pubDate` / `category` / `content:encoded` / `dc:creator` のみ。`rel="canonical"` は含まれない
- 返却されるのは直近 10 件のみ。Medium 上の全 23 記事は RSS では取得できない（全件が必要な場合は別手段が要る）

---

### Tier 4: 静的リンク / 手動入力

以下のプラットフォームは API/RSS が利用不可または制限があるため、手動でリンク集として管理。

| プラットフォーム | URL | 備考 |
|-----------------|-----|------|
| Codesandbox | `codesandbox.io/u/ksyunnnn` | 公開 API なし |
| Codepen | `codepen.io/ksyunnnn` | embed のみ |
| Speaker Deck | `speakerdeck.com/ksyunnnn` | oEmbed のみ |
| TECHPLAY | 各イベントページ | API なし |
| Stack Overflow | プロフィールURL | 制限あり |

---

### Tier 5: サイト固有コンテンツ（internal）

synsk.me 内でのみ公開するコンテンツ。

| コンテンツ種別 | 例 | ActivityType |
|---------------|-----|--------------|
| notes | サイト固有の記事、リリースノート | `article` |
| プロフィール | 経歴、実績の詳細 | - （別構造） |
| リリース告知 | プロダクト公開のお知らせ | `article` + `works` |

**特徴**:
- 完全手動入力
- DisplayCategory は手動で設定
- catnose.me の `/notes` に相当

**外部プラットフォームへの転載（POSSE）**:

ADR-0006 により、internal コンテンツは synsk.me を正本として
外部プラットフォームへ転載する。転載した記事は internal エントリと転載先プラットフォームのエントリとして
二重に集約されるため、集約時に除外する。

- internal 側が `syndicatedTo: string[]`（転載先 URL）を保持する
- 集約時、`syndicatedTo` に含まれる URL を持つ外部エントリを除外する
- 転載先の `rel="canonical"` を読んで判定する方式は採らない（Medium の RSS に canonical が含まれないため。上記 Tier 分類 8番の Medium を参照）

---

## 統合アーキテクチャ

### Next.js での実装パターン

```
synsk.me/
├── app/
│   ├── api/
│   │   └── revalidate/
│   │       └── route.ts      # Webhook 受信エンドポイント
│   ├── activity/
│   │   └── page.tsx          # 統合タイムラインページ
│   └── ...
├── lib/
│   ├── fetchers/
│   │   ├── github.ts         # GitHub API クライアント
│   │   ├── zenn.ts           # Zenn RSS パーサー
│   │   ├── qiita.ts          # Qiita API クライアント
│   │   ├── devto.ts          # dev.to API クライアント
│   │   └── types.ts          # 統一データ型
│   └── aggregator.ts         # 全プラットフォーム集約
└── ...
```

### 統一データ型

> **詳細設計**: [content-model-design.md](./content-model-design.md) を参照

```typescript
// lib/fetchers/types.ts
export type Platform =
  | 'github'
  | 'zenn'
  | 'qiita'
  | 'devto'
  | 'medium'
  | 'connpass'
  | 'codesandbox'
  | 'speakerdeck'
  | 'techplay'
  | 'spotify'      // 追加: プレイリスト
  | 'twitter'      // 追加: 投稿埋め込み
  | 'internal';    // 追加: サイト固有コンテンツ

export type ActivityType =
  | 'article'
  | 'repository'
  | 'event'
  | 'talk'
  | 'sandbox'
  | 'post'         // 追加: SNS投稿
  | 'playlist'     // 追加: プレイリスト
  | 'misc';

export type DisplayCategory =
  | 'works'        // 作ったもの
  | 'writing'      // 記事、思考
  | 'activity'     // イベント、登壇
  | 'misc';        // その他

export interface Activity {
  id: string;
  platform: Platform;
  type: ActivityType;
  displayCategory: DisplayCategory;  // 表示用カテゴリ（手動上書き可能）
  title: string;
  url: string;
  publishedAt: Date;
  description?: string;
  metadata: PlatformMetadata;        // プラットフォーム固有データ
  fetchStatus: 'success' | 'partial' | 'failed';
}
```

### ISR + Webhook ハイブリッド戦略

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const body = await request.json();

  // GitHub / Zenn からの Webhook
  if (body.source === 'github' || body.source === 'zenn') {
    revalidatePath('/activity');
    revalidatePath('/');
  }

  return NextResponse.json({ revalidated: true });
}
```

---

## 表示形式の検討

### 1. 統合タイムライン

全プラットフォームの最新活動を時系列で表示。

```
┌─────────────────────────────────────────────┐
│ 2026-01-28  Zenn   TypeScriptの型推論を...   │
│ 2026-01-25  GitHub synsk.me v0.2.0 released │
│ 2026-01-20  Zenn   Next.js 15のキャッシュ... │
│ 2026-01-15  GitHub slash-commands ★1        │
└─────────────────────────────────────────────┘
```

### 2. プラットフォーム別セクション

```
┌── Zenn ────────────────────┐
│ • 記事1                    │
│ • 記事2                    │
│ • 記事3                    │
└────────────────────────────┘
┌── GitHub ──────────────────┐
│ • repo1 ★12                │
│ • repo2 ★5                 │
└────────────────────────────┘
```

### 3. ハイライトのみ

各プラットフォームから厳選した 1-3 件を表示。

### 4. アクティビティグラフ

GitHub Contribution グラフ風に、全プラットフォームの活動を可視化。

### 5. Knowledge Graph（Obsidian インスピレーション）

> **参照**: [Obsidian とは - Zenn](https://zenn.dev/estra/books/obsidian-dot-zenn/viewer/2-oz-what-is-obsidian)

Obsidianのローカルグラフビューに着想を得た、**関心領域の関連性可視化**。

#### コンセプト

```
                    ┌─────────┐
                    │  React  │
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │TypeScript│     │Next.js  │     │  UI/UX  │
   └────┬────┘     └────┬────┘     └────┬────┘
        │               │               │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │  Zod    │     │Supabase │     │ Figma   │
   └─────────┘     └─────────┘     └─────────┘
                         │
                    ┌────▼────┐
                    │ Design  │
                    │ System  │
                    └─────────┘
```

#### Obsidian のグラフビュー特性

| 特性 | 説明 | デザイン応用 |
|-----|------|-------------|
| **ローカルグラフ** | 選択中のノードを中心に、直接リンクのみ表示 | 選択した関心領域の隣接領域を表示 |
| **グローバルグラフ** | 全ノード間の関係を俯瞰 | 全関心領域のネットワーク |
| **双方向リンク** | A→B で自動的に B→A も生成 | 技術→プロジェクト、プロジェクト→技術 |
| **クラスタリング** | 関連ノードが近くに配置 | Frontend / Backend / Design のクラスタ |
| **ノードサイズ** | リンク数に応じてサイズ変化 | 活動量・記事数で重み付け |

#### 可視化候補

1. **技術スタック関連図**
   - 中心: React / TypeScript
   - 周辺: 関連ライブラリ、フレームワーク
   - リンク: 実際に組み合わせて使ったプロジェクト

2. **関心領域マップ**
   - クラスタ: Frontend / Backend / Design / Music
   - エッジ: 領域間の接点（例: Design → Design System → Frontend）

3. **時系列 + グラフのハイブリッド**
   - 横軸: 時間
   - 縦軸/ノード: 技術・関心領域
   - リンク: 同時期に取り組んだもの

#### 技術的実装候補

| ライブラリ | 特徴 | 適合度 |
|-----------|------|--------|
| [D3.js Force Graph](https://d3js.org/) | 高度なカスタマイズ、学習コスト高 | ★★★ |
| [vis.js Network](https://visjs.github.io/vis-network/) | バランス良い、設定しやすい | ★★★★ |
| [Cytoscape.js](https://js.cytoscape.org/) | グラフ理論向け、学術的 | ★★ |
| [React Flow](https://reactflow.dev/) | React ネイティブ、ノードベース | ★★★★ |

#### デザイン参考

- **Obsidian**: 暗めの背景、ノードが光る、有機的な動き
- **Roam Research**: よりミニマル、リンクに焦点
- **Notion**: 静的だがクリーン

#### 検討ポイント

- [ ] インタラクティブ vs 静的画像
- [ ] ホバー時の情報表示（記事数、最終更新）
- [ ] クリック時の遷移先（フィルタリング? 詳細ページ?）
- [ ] パフォーマンス（ノード数が多い場合）
- [ ] アクセシビリティ（キーボードナビゲーション）

---

## 実装優先度

| 優先度 | プラットフォーム | 理由 |
|--------|-----------------|------|
| 1 | GitHub | API 安定、Webhook 対応、メイン活動 |
| 2 | Zenn | RSS 安定、技術発信のメイン |
| 3 | Qiita | API あり、アーカイブとして価値 |
| 4 | dev.to | API あり、英語発信 |
| 5 | connpass | API あり、コミュニティ実績 |
| 6 | Medium | RSS のみ、更新停止中 |
| 7 | その他 | 静的リンクで対応 |

---

## 必要な環境変数

```env
# GitHub
GITHUB_TOKEN=ghp_xxxx

# Qiita（任意）
QIITA_TOKEN=xxxx

# Webhook 検証用
REVALIDATE_SECRET=xxxx
```

---

## 次のステップ

1. [ ] GitHub API 統合の実装（Tier 1）
2. [ ] Zenn RSS パーサーの実装（Tier 1）
3. [ ] 統一データ型の定義
4. [ ] ISR + Webhook のセットアップ
5. [ ] 表示コンポーネントの設計
6. [ ] Qiita / dev.to の追加（Tier 2）

---

## 決定事項

### データストア: DuckDB

**決定**: データストアとして DuckDB を採用

**選定理由**:
1. **埋め込み型**: 外部サービス（Supabase 等）への依存なし
2. **分析向き**: 列指向で集計クエリに強い
3. **JSON 直接クエリ**: API レスポンスをそのまま分析可能
4. **技術的興味**: 実際に使った経験を発信のネタにできる

**トレードオフ**:
- データ量（数百件）に対してはオーバースペック
- 「オーバースペックだけど使ってみたい」は個人サイトでは正当な理由

**検討した代替案**:

| 選択肢 | 不採用理由 |
|--------|-----------|
| キャッシュのみ（ISR + Vercel KV） | 履歴蓄積不可、分析不可 |
| Supabase（PostgreSQL） | 外部依存、コスト、オーバースペック |
| SQLite | 分析クエリに劣る、技術的新鮮味が薄い |

**実装パターン**:

```
ビルド時:
  API/RSS → JSON/Parquet 生成 → DuckDB でクエリ → 静的ページ生成

or

ランタイム (WASM):
  DuckDB-WASM でブラウザ側集計 → インタラクティブな可視化
```

→ 詳細は [ADR-0007](../adr/0007-duckdb-wasm-datastore.md) を参照

---

### Zenn の連携方式

**決定**: Web エディタのみ使用（GitHub 連携なし）

→ Webhook は使用不可。RSS での定期取得（ISR）で対応。

### 実装タイミング

**決定**: デザインシステム確立後に実装を開始する。それまでは手動データを使用する。

---

## 未解決の検討事項

### Q1: 表示形式の最終決定

- 統合タイムライン vs プラットフォーム別
- トップページに表示するか、専用ページを作るか

### Q3: データのキャッシュ戦略

- Vercel KV / Edge Config を使うか
- ISR の revalidate 間隔（1時間、1日、1週間）

---

*関連 ADR: ADR-0002, ADR-0007*
*関連設計: [content-model-design.md](./content-model-design.md)*
