# Roadmap

> synsk.me リデザインプロジェクトの全体像

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| **目的** | synsk.meをVISION.mdとPRINCIPLES.mdに基づいてリデザイン/再構築する |
| **完了条件** | 新デザインで本番公開 |

---

## 進め方

### ブランチ戦略

```
feature/redesign ブランチで作業
      ↓
PR を作成（main へ）
      ↓
Vercel が自動で Preview URL を生成
      ↓
Preview で確認・実験・調整
      ↓
準備完了後 main にマージ → 本番デプロイ
```

### 原則

- **実験 over 完璧な計画**: Preview環境で積極的に試す
- **余白 over 密度**: 過剰な管理をしない
- デザインと実装は行き来しながら進める（ウォーターフォールではない）

### デザインアプローチ: モノクロファースト

```
モノクロ（グレースケール）で構造を固める
      ↓
タイポグラフィ・スペーシングを決定
      ↓
実装 & プレビューで検証
      ↓
最後にカラートークンを検討（必要に応じて）
```

**意図**: 色に頼らない情報設計を行い、「息づき over 装飾」を実現する

---

## フェーズ

### Phase 1: 基盤構築

| タスク | 状態 | 備考 |
|--------|------|------|
| VISION.md | ✅ | Working Backwards形式 |
| PRINCIPLES.md（Core） | ✅ | 余白・実験・おもしろさ |
| PRINCIPLES.md（Design） | ✅ | 余白・息づき・対話 |
| 発信コンテンツ分析 | ✅ | docs/research/tweets-insight/, content-analysis/ |
| Design Tokens（グレースケール） | ✅ | Neutral Gray で構造を固める |
| Design Tokens（タイポグラフィ） | ✅ | 暫定、実装検証で調整（Source Sans 3 + Noto Sans JP, Light 300） |
| Design Tokens（スペーシング） | ✅ | 8px ベース（xs/sm/md/lg/xl） |

### Phase 1.5: サイト要件定義

**根拠**: Working Backwards の次ステップ（Press Release → FAQ → **User Manual** → Architecture）

| タスク | 状態 | 備考 |
|--------|------|------|
| コンテンツ要件 | ⏳ | 何を載せるか（実績、プロフィール等） |
| 機能要件 | ⏳ | 何ができるようにするか（コンタクト方法等） |
| 情報設計 | ⏳ | ページ構成、ナビゲーション、優先順位 |

### Phase 2: デザイン & 実装（反復）

| タスク | 状態 | 備考 |
|--------|------|------|
| ビジュアルデザイン | ⏳ | モノクロで実装 |
| コンポーネント実装 | ⏳ | Pencil → React 検証含む |
| アニメーション/インタラクション | ⏳ | 息づき over 装飾 |
| カラートークン検証 | ⏳ | 最後に色味を検討 |

### Phase 3: 公開

| タスク | 状態 | 備考 |
|--------|------|------|
| レビュー/調整 | ⏳ | |
| main へマージ | ⏳ | 本番デプロイ |

---

## 次のアクション

### Step 1: サイト要件定義 ⏳

**根拠**: Working Backwards（VISION.md で採用済み）の次ステップ

```
Press Release → FAQ → User Manual → Architecture
                       ↑ 今ここ
```

#### 1-1. コンテンツ要件

VISION.md の FAQ「訪問者が何を求めるか」から導出：

| 訪問者の質問 | 必要なコンテンツ | 決定 |
|-------------|-----------------|------|
| 「これは何ですか？」 | 自己紹介、ポジショニング | [ ] |
| 「誰のためのものですか？」 | ターゲット明示 | [ ] |
| 「他と何が違いますか？」 | 差別化、共創の入り口 | [ ] |
| 「依頼には何が必要ですか？」 | 敷居の低さ説明 | [ ] |

**追加で決めること**:
- [ ] 実績/ポートフォリオの掲載範囲
- [ ] プロフィールの詳細度
- [ ] テキストは VISION.md 流用 or 新規作成

#### 1-2. 機能要件

Jobs to be Done: 「訪問者はこのサイトを"雇って"何を達成したいか？」

| Job | 必要な機能 | 決定 |
|-----|-----------|------|
| この人が何者か知りたい | プロフィール表示 | [ ] |
| 一緒に仕事できるか判断したい | 実績閲覧 | [ ] |
| コンタクトしたい | 連絡手段 | [ ] |
| 要件なしで相談できるか確認 | 明示的メッセージ | [ ] |

**追加で決めること**:
- [ ] コンタクト方法（フォーム / SNSリンク / 両方）
- [ ] 外部コンテンツへのリンク（Zenn, GitHub 等）

#### 1-3. 情報設計

| 決定事項 | 選択肢 | 決定 |
|---------|--------|------|
| ページ構成 | シングルページ / マルチページ | [ ] |
| ナビゲーション | 固定 / スクロール連動 / なし | [ ] |
| ファーストビュー | 何を最初に見せるか | [ ] |
| セクション順序 | VISION.md 順 / カスタム | [ ] |

---

### Step 2: Pencil コンポーネント作成

**前提**: Step 1 完了後に実施

**目的**: Figma ⇔ React連携問題をPencilで解決できるか検証

**進捗**:
1. [x] `design/foundations.pen` を Pencil で作成
2. [x] Colors セクション（Light Mode + Dark Mode スウォッチ）
3. [x] Typography セクション（フォント情報 + Type Scale）
4. [x] Spacing セクション（スケール + Usage 説明）
5. [x] Variables 定義（10色、スウォッチと連動）
6. [ ] Article Design サンプル（オプション、必要時に追加）
7. [ ] **Step 1 完了後** → 実際のページ/コンポーネント作成

**Design Tokens 設定値（確定済み）**:
```
Colors: background, foreground, muted, muted-foreground, border（Light/Dark対応）
Typography: Source Sans 3 + Noto Sans JP, Light 300, 18px, line-height 1.8
Spacing: 8px ベース（xs:8, sm:16, md:24, lg:48, xl:96）
```

**トークン同期方針（決定済み）**:
- Pencil `get_variables` API で .pen からトークン抽出可能（検証済み）
- 同期スクリプト作成は Phase 2 実装フェーズで必要に応じて対応
- 現時点では foundations.md をマスターとして手動同期で運用

---

### Step 3: 実装フェーズへ移行

1. ~~Design Tokens（グレースケール）の確定~~ ✅
2. ~~Design Tokens（タイポグラフィ）の策定~~ ✅
3. ~~Design Tokens（スペーシング）の策定~~ ✅
4. `feature/redesign` ブランチを作成
5. Phase 2 開始

---

## 関連ドキュメント

- [VISION.md](./VISION.md) - synsk.meが何であるべきか
- [PRINCIPLES.md](./PRINCIPLES.md) - 判断基準
- [Design Foundations](./design/foundations.md) - デザイントークン

---

## Version History

| Date | Changes |
|------|---------|
| 2026-01-27 | 初版作成 |
| 2026-01-27 | モノクロファーストアプローチを追加、Design Tokensタスクを分解 |
| 2026-01-30 | Phase 1.5「サイト要件定義」追加、Working Backwards に基づく決定フロー明確化 |
| 2026-01-30 | foundations.pen 再構築（Dark Mode、Type Scale、Variables 追加） |
