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

### Phase 1: 基盤構築 [完了]

| タスク | 状態 | 備考 |
|--------|------|------|
| VISION.md | 完了 | Working Backwards形式 |
| PRINCIPLES.md（Core） | 完了 | 余白・実験・おもしろさ |
| PRINCIPLES.md（Design） | 完了 | 余白・息づき・対話 |
| 発信コンテンツ分析 | 完了 | docs/research/tweets-insight/, content-analysis/ |
| Design Tokens | 完了 | [ADR-0005](./adr/0005-design-tokens.md) |

### Phase 1.5: サイト要件定義 [完了]

**根拠**: Working Backwards の次ステップ（Press Release → FAQ → **User Manual** → Architecture）

| タスク | 状態 | 備考 |
|--------|------|------|
| コンテンツ要件 | 完了 | データモデル決定済み（[ADR-0003](./adr/0003-content-data-model.md)） |
| 情報設計 | 完了 | **Changelog型タイムライン**を採用（[catnose分析](./research/catnose-design-analysis.md)参照） |
| デザインパターン探索 | 完了 | exploration-content-patterns.pen、**Timeline B: Verb + Platform** 採用 |
| アイコンシステム | 完了 | Phosphor Icons 統一、Platform アイコン戦略決定（[ADR-0004](./adr/0004-icon-system.md)） |

### Phase 2: デザイン & 実装（反復）

> 詳細タスクは [GitHub Issues](https://github.com/ksyunnnn/synsk.me/issues) で管理

#### Timeline コンポーネント

| タスク | 状態 | Issue | 備考 |
|--------|------|-------|------|
| ArticleEntry | 未着手 | [#5](https://github.com/ksyunnnn/synsk.me/issues/5) | デザイン確定済み（Pattern B: Inline Platform） |
| PlaylistSection | 未着手 | [#6](https://github.com/ksyunnnn/synsk.me/issues/6) | カード型 or リスト型を検討中 |
| RepositoryEntry | 未着手 | [#8](https://github.com/ksyunnnn/synsk.me/issues/8) | GitHub、Article と同様の構造予定 |
| EventEntry | 未着手 | [#9](https://github.com/ksyunnnn/synsk.me/issues/9) | Connpass, TECHPLAY |
| TalkEntry | 未着手 | [#10](https://github.com/ksyunnnn/synsk.me/issues/10) | SpeakerDeck |
| SandboxEntry | 未着手 | [#11](https://github.com/ksyunnnn/synsk.me/issues/11) | CodeSandbox, CodePen |
| PostEntry | 未着手 | [#12](https://github.com/ksyunnnn/synsk.me/issues/12) | X (Twitter) |
| Timeline 統合 | 未着手 | [#14](https://github.com/ksyunnnn/synsk.me/issues/14) | 年グルーピング、全体レイアウト |

#### データ基盤

| タスク | 状態 | Issue | 備考 |
|--------|------|-------|------|
| SpotifyMetadata 型更新 | 未着手 | [#7](https://github.com/ksyunnnn/synsk.me/issues/7) | oEmbed 対応（[検証ログ](./research/spotify-api-verification.md)） |
| oEmbed fetcher 実装 | 未着手 | [#7](https://github.com/ksyunnnn/synsk.me/issues/7) | ビルド時取得 |
| 手動登録データファイル | 未着手 | [#7](https://github.com/ksyunnnn/synsk.me/issues/7) | プレイリストURL管理 |

#### 機能要件

| タスク | 状態 | 備考 |
|--------|------|------|
| コンタクト方法 | 未着手 | フォーム / SNS リンク |
| ページ構成 | 未着手 | シングル / マルチ |
| ナビゲーション | 未着手 | 固定 / スクロール連動 / なし |
| ファーストビュー | 未着手 | 何を最初に見せるか |
| セクション順序 | 未着手 | VISION.md 順 / カスタム |

#### その他

| タスク | 状態 | 備考 |
|--------|------|------|
| アニメーション/インタラクション | 未着手 | 息づき over 装飾 |
| カラートークン検証 | 未着手 | 最後に色味を検討 |

### Phase 3: 公開

| タスク | 状態 | 備考 |
|--------|------|------|
| レビュー/調整 | 未着手 | |
| main へマージ | 未着手 | 本番デプロイ |

---

## 現在のフォーカス

Phase 2 の開始準備中。

### 次のステップ

1. `feature/redesign` ブランチを作成
2. 最初のタスク: [#5 ArticleEntry](https://github.com/ksyunnnn/synsk.me/issues/5)

---

## 関連ドキュメント

- [VISION.md](./VISION.md) - synsk.meが何であるべきか
- [PRINCIPLES.md](./PRINCIPLES.md) - 判断基準
- [ADR-0003: Content Data Model](./adr/0003-content-data-model.md) - データモデル
- [ADR-0004: Icon System](./adr/0004-icon-system.md) - アイコンシステム
- [ADR-0005: Design Tokens](./adr/0005-design-tokens.md) - デザイントークン
- [catnose.me デザイン分析](./research/catnose-design-analysis.md) - Changelog型パターンの参考調査
- [Content Model 設計](./research/content-model-design.md) - データ構造の設計
- [Hub-and-Spoke モデル](./research/hub-and-spoke-model.md) - データ取得アーキテクチャ

---

## Version History

| Date | Changes |
|------|---------|
| 2026-01-27 | 初版作成 |
| 2026-01-27 | モノクロファーストアプローチを追加、Design Tokensタスクを分解 |
| 2026-01-30 | Phase 1.5「サイト要件定義」追加、Working Backwards に基づく決定フロー明確化 |
| 2026-01-30 | foundations.pen 再構築（Dark Mode、Type Scale、Variables 追加） |
| 2026-01-31 | Hub-and-Spoke モデル検討事項を追加（ADR-0002） |
| 2026-01-31 | Phase 1.5 進捗更新: Changelog型タイムライン採用、catnose分析追加 |
| 2026-01-31 | Content Model 設計開始、hub-and-spoke-model に Spotify/Twitter/internal 追加 |
| 2026-02-02 | データモデル決定（C: 分離モデル）、ADR-0003 追加 |
| 2026-02-02 | Timeline デザイン決定: **Timeline B: Verb + Platform** 採用 |
| 2026-02-02 | アイコンシステム決定: Phosphor Icons + Simple Icons、ADR-0004 追加 |
| 2026-02-03 | Phase 2 詳細化、GitHub Issues 連携（#5, #6, #7） |
| 2026-02-03 | ドキュメント整理: design/ 廃止、ADR-0005 追加、ROADMAP 簡素化 |
| 2026-02-03 | ROADMAP レビュー: 状態表記統一、機能要件を Phase 2 に移動、#14 作成 |
