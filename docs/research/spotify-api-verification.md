# Spotify API 検証ログ

> この文書は決定の正本ではない。決定は docs/adr/ にある。

> synsk.me で Spotify プレイリストを表示するための API 検証

## Contents

- 目的
- 要件
- 検証ステップ
- 作業ログ
- 実装方針（方式 A: oEmbed + 手動登録）
- 参考リンク

---

---

## 目的

個人サイト synsk.me のタイムラインに、自分の Spotify 公開プレイリストを表示したい。

### 背景

- synsk.me は Hub-and-Spoke モデルで外部プラットフォームからデータを取得する設計
- Spotify は `playlist` タイプとして ActivityType に定義済み
- DisplayCategory は `misc`（その他）に分類

### ゴール

1. Spotify Web API で自分（`synsk`）の公開プレイリスト一覧を取得できることを確認
2. 必要なデータ（名前、URL、トラック数、フォロワー数等）が取得可能か検証
3. 認証フローを確定し、実装方針を決定

---

## 要件

### 取得したいデータ

| フィールド | 用途 | 優先度 |
|-----------|------|--------|
| プレイリスト名 | タイムライン表示 | 必須 |
| URL | リンク先 | 必須 |
| 説明 | 補足情報 | あれば |
| トラック数 | メタデータ表示 | あれば |
| フォロワー数 | メタデータ表示 | あれば |
| 公開/非公開フラグ | フィルタリング | 必須 |
| コラボレーティブフラグ | メタデータ | あれば |

### 対応する TypeScript 型（content-model-design.md より）

```typescript
interface SpotifyMetadata {
  platform: 'spotify';
  trackCount?: number;
  followerCount?: number;
  isPublic?: boolean;
  collaborative?: boolean;
}
```

### 制約

- サーバーサイドでの定期取得（ISR: 週1回程度）を想定
- ユーザー操作なしで自動取得したい（可能であれば）
- 環境変数で認証情報を管理

---

## 検証ステップ

### Step 1: Spotify Developer 登録

- [x] Spotify Developer Dashboard でアプリ作成 → **失敗（新規作成停止中）**
- [ ] ~~Client ID / Client Secret 取得~~
- [ ] ~~Redirect URI 設定~~

### Step 2: 代替手段の検証

- [x] oEmbed API の調査・動作確認
- [x] 取得可能データの確認
- [x] 制限事項の把握

### Step 3: 実装方針の確定

- [x] **方針 A（oEmbed + 手動登録）** を採用
- [ ] データ構造の設計
- [ ] fetcher 関数の実装

---

## 作業ログ

### 2026-02-03: 調査開始

#### 重要: Spotify Developer API の状況（2026-02-03 時点）

**新規アプリ作成が一時停止中の可能性あり**

- 2024年11月: 推薦系 API の大量廃止
- 2025年4月: Extended Access の審査基準厳格化（95% が却下）
- 2026-02-03 時点: 新規アプリ作成時に「New integrations are currently on hold」と表示される報告あり

**影響**
- Development Mode: 25ユーザーまで（個人利用には十分）
- Extended Mode: 新規申請が実質不可
- 既存アプリは規約遵守していれば継続利用可能

**参考**
- [Quota modes | Spotify](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Updating the Criteria for Web API Extended Access](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- [TechCrunch: Spotify cuts developer access](https://techcrunch.com/2024/11/27/spotify-cuts-developer-access-to-several-of-its-recommendation-features/)

→ まず Dashboard でアプリ作成可能か確認する

#### Dashboard 確認結果

**結果: 新規アプリ作成不可**

Dashboard にアクセスしたところ、新規アプリ作成がブロックされていることを確認。
Web API（認証必須）を使った方式は断念。

---

#### oEmbed API 検証

**認証不要の公式 API が存在**

```
GET https://open.spotify.com/oembed?url={spotify_url}
```

**テスト実行**

```bash
curl "https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
```

**レスポンス**

```json
{
  "title": "Today's Top Hits",
  "thumbnail_url": "https://i.scdn.co/image/ab67706f000000028ebecc3eb42507e42264a232",
  "thumbnail_width": 300,
  "thumbnail_height": 300,
  "html": "<iframe style=\"border-radius: 12px\" width=\"100%\" height=\"352\" ...></iframe>",
  "iframe_url": "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=oembed",
  "width": 456,
  "height": 352,
  "version": "1.0",
  "provider_name": "Spotify",
  "provider_url": "https://spotify.com",
  "type": "rich"
}
```

**取得可能データ比較**

| フィールド | oEmbed | Web API | 要件 |
|-----------|--------|---------|------|
| プレイリスト名 | ✅ `title` | ✅ | 必須 |
| URL | ✅ 入力から復元 | ✅ | 必須 |
| サムネイル | ✅ `thumbnail_url` | ✅ | - |
| 埋め込み HTML | ✅ `html` | - | - |
| 説明 | ❌ | ✅ | あれば |
| トラック数 | ❌ | ✅ | あれば |
| フォロワー数 | ❌ | ✅ | あれば |
| 公開フラグ | ❌ | ✅ | 必須 |

**制限**

- プレイリスト一覧の取得は不可（URLを事前に知っている必要あり）
- 詳細メタデータ（トラック数、フォロワー数、説明）は取得不可
- 公開フラグは取得不可（手動で管理する必要あり）

---

#### 代替案の検討

| 方式 | 説明 | 採否 |
|------|------|------|
| **A. oEmbed + 手動登録** | URLを手動登録、oEmbedで名前・サムネイル取得 | ✅ 採用 |
| B. 埋め込みのみ | iframe embed を直接使用 | データ管理不可 |
| C. スクレイピング | 非公式、規約違反リスク | ❌ |
| D. API 開放待ち | 将来的に再開を待つ | 時期不明 |

**採用理由（方式 A）**

- 認証不要で安定運用可能
- プレイリスト名・サムネイルは自動取得できる
- 手動登録は数件程度なので運用負荷は低い
- 「余白 over 完成形」原則に沿う（完璧なデータより動くものを優先）

---

#### 事前調査で判明した事項

**エンドポイント**
```
GET https://api.spotify.com/v1/users/{user_id}/playlists
```

**認証方式の選択肢**

| 方式 | 特徴 | ユーザーログイン |
|------|------|-----------------|
| Client Credentials Flow | サーバー間認証、ユーザー情報アクセス制限あり | 不要 |
| Authorization Code Flow | 全機能アクセス可能、refresh token で長期運用 | 初回1回必要 |

**未確認事項**
- Client Credentials Flow で他ユーザーの公開プレイリストが取得できるか
- `followers.total` がリスト取得時に含まれるか（詳細エンドポイントが必要かも）

---

## 実装方針（方式 A: oEmbed + 手動登録）

### データフロー

```
手動登録（プレイリストURL）
    ↓
ビルド時に oEmbed API 呼び出し
    ↓
title, thumbnail_url を取得
    ↓
Activity データとして保存
    ↓
タイムラインに表示
```

### 手動登録データ

```typescript
// 手動で管理するプレイリスト一覧
const spotifyPlaylists = [
  {
    url: 'https://open.spotify.com/playlist/xxxxx',
    publishedAt: '2024-01-15',  // 作成日（手動）
    description: 'お気に入りの曲',  // 説明（手動、任意）
  },
  // ...
];
```

### SpotifyMetadata 型の調整案

```typescript
// 変更前（content-model-design.md）
interface SpotifyMetadata {
  platform: 'spotify';
  trackCount?: number;      // ❌ oEmbed では取得不可
  followerCount?: number;   // ❌ oEmbed では取得不可
  isPublic?: boolean;       // ❌ oEmbed では取得不可
  collaborative?: boolean;  // ❌ oEmbed では取得不可
}

// 変更後（oEmbed 対応）
interface SpotifyMetadata {
  platform: 'spotify';
  thumbnailUrl?: string;    // ✅ oEmbed から取得
  embedHtml?: string;       // ✅ oEmbed から取得（任意）
  embedUrl?: string;        // ✅ oEmbed から取得
}
```

### 次のステップ

1. [ ] 自分のプレイリスト URL を収集
2. [ ] 手動登録用のデータファイル作成
3. [ ] oEmbed fetcher 関数の実装
4. [ ] content-model-design.md の SpotifyMetadata 更新

---

## 参考リンク

### oEmbed API（採用）

- [Using the oEmbed API | Spotify](https://developer.spotify.com/documentation/embeds/tutorials/using-the-oembed-api)

### Web API（参考: 新規アプリ作成停止中）

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Authorization](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [Get User's Playlists](https://developer.spotify.com/documentation/web-api/reference/get-list-users-playlists)
- [Client Credentials Flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)

### API 制限に関する情報

- [Quota modes | Spotify](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Updating the Criteria for Web API Extended Access](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- [Spotify cuts developer access | TechCrunch](https://techcrunch.com/2024/11/27/spotify-cuts-developer-access-to-several-of-its-recommendation-features/)

