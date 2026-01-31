# Hub-and-Spoke モデル設計検討

> synsk.me をハブ（中心）として、各プラットフォームから最新データを取得・統合するアーキテクチャ

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
        ┌────────────────────┼────────────────────┐
        │          │         │         │          │
   ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
   │  Zenn   │ │GitHub │ │Qiita  │ │dev.to │ │Medium │
   │  (RSS)  │ │ (API) │ │ (API) │ │ (API) │ │ (RSS) │
   └─────────┘ └───────┘ └───────┘ └───────┘ └───────┘

   Webhook ✗   Webhook ✓   ✗          ✗         ✗
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

### Tier 3: RSS のみ（定期取得）

#### 6. Medium

| 項目 | 内容 |
|------|------|
| ユーザー名 | `@syunsukekobashi` |
| 取得方法 | RSS フィード |
| Webhook | ❌ 非対応 |
| 最終更新 | 2021年（アーカイブ扱い） |

**RSS URL**: `https://medium.com/feed/@syunsukekobashi`

**更新戦略**: 静的（更新なしのため）

---

### Tier 4: 静的リンクのみ

以下のプラットフォームは API/RSS が利用不可または制限があるため、手動でリンク集として管理。

| プラットフォーム | URL | 備考 |
|-----------------|-----|------|
| Codesandbox | `codesandbox.io/u/ksyunnnn` | 公開 API なし |
| Codepen | `codepen.io/ksyunnnn` | embed のみ |
| Speaker Deck | `speakerdeck.com/ksyunnnn` | oEmbed のみ |
| TECHPLAY | 各イベントページ | API なし |
| Stack Overflow | プロフィールURL | 制限あり |

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

```typescript
// lib/fetchers/types.ts
export type Platform =
  | 'github'
  | 'zenn'
  | 'qiita'
  | 'devto'
  | 'medium'
  | 'codesandbox'
  | 'speakerdeck';

export type ActivityType =
  | 'article'
  | 'repository'
  | 'commit'
  | 'event'
  | 'talk';

export interface Activity {
  id: string;
  platform: Platform;
  type: ActivityType;
  title: string;
  url: string;
  publishedAt: Date;
  description?: string;
  metadata?: Record<string, unknown>;
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

→ 詳細は [ADR-0002](../adr/0002-hub-and-spoke-data-architecture.md) を参照

---

### Zenn の連携方式

**決定**: Web エディタのみ使用（GitHub 連携なし）

→ Webhook は使用不可。RSS での定期取得（ISR）で対応。

### 実装タイミング

**決定**: フェーズ 1.5 以降

→ デザインシステム確立後に実装開始。MVP では手動データを使用。

---

## 未解決の検討事項

### Q1: 表示形式の最終決定

- 統合タイムライン vs プラットフォーム別
- トップページに表示するか、専用ページを作るか

### Q3: データのキャッシュ戦略

- Vercel KV / Edge Config を使うか
- ISR の revalidate 間隔（1時間、1日、1週間）

---

*作成日: 2026-01-31*
*ステータス: 方針決定済み（実装はフェーズ 1.5 以降）*
*関連 ADR: [ADR-0002](../adr/0002-hub-and-spoke-data-architecture.md)*
