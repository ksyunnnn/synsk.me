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
| Design Tokens（タイポグラフィ） | ⏳ | フォントサイズ・行間 |
| Design Tokens（スペーシング） | ⏳ | 余白のスケール |

### Phase 2: デザイン & 実装（反復）

| タスク | 状態 | 備考 |
|--------|------|------|
| ページ構成決定 | ⏳ | |
| ビジュアルデザイン | ⏳ | モノクロで実装 |
| コンポーネント実装 | ⏳ | |
| アニメーション/インタラクション | ⏳ | 息づき over 装飾 |
| カラートークン検証 | ⏳ | 最後に色味を検討 |

### Phase 3: 公開

| タスク | 状態 | 備考 |
|--------|------|------|
| レビュー/調整 | ⏳ | |
| main へマージ | ⏳ | 本番デプロイ |

---

## 次のアクション

1. ~~Design Tokens（グレースケール）の確定~~ ✅
2. Design Tokens（タイポグラフィ）の策定
3. Design Tokens（スペーシング）の策定
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
