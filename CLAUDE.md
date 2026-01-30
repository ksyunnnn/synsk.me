# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

### 基本的な開発コマンド
```bash
# 開発サーバー起動（Turbopack使用）
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm start

# リンター実行
npm run lint
```

### 開発環境
- ローカル開発サーバー: http://localhost:3000
- 開発時はTurbopackを使用して高速なビルドを実現

## アーキテクチャ

### 技術スタック
- **Framework**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS + CSS-in-JS
- **フォント**: Source Sans 3 + Noto Sans JP (Google Fonts) ※リデザイン後
- **アイコン**: Phosphor Icons, Lucide React, FontAwesome
- **アナリティクス**: Google Tag Manager

### プロジェクト構造
```
src/
├── app/                    # App Routerのページとレイアウト
│   ├── layout.tsx         # ルートレイアウト（メタデータ、フォント、Analytics）
│   ├── page.tsx           # ホームページ（工事中表示）
│   ├── globals.css        # グローバルスタイル
│   ├── Analytics.tsx      # GTM設定（本番環境のみ動作）
│   ├── archives/          # アーカイブページ
│   └── asset/             # SVGアセット
├── components/ui/         # 再利用可能なUIコンポーネント
├── lib/                   # ユーティリティ関数
│   ├── gtm.ts            # Google Analytics設定
│   ├── utils.ts          # 共通ユーティリティ
│   └── createMetadata.ts # メタデータ生成ヘルパー
└── icon.tsx              # カスタムアイコンコンポーネント
```

### 重要な設定ファイル
- `tailwind.config.ts`: カスタムスクリーンサイズとデザインシステム対応
- `components.json`: shadcn/ui設定
- `next.config.js`: 基本的なNext.js設定（現在はデフォルト）

### アナリティクス
- 本番環境のみでGoogle Tag Managerが動作
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`環境変数が必要
- ページビュー自動トラッキング機能あり

### デザインシステム
- Tailwind CSSのカスタムカラーパレット（CSS変数ベース）
- レスポンシブデザイン対応（sm: 480px, md: 768px, lg: 976px, xl: 1440px）
- ダークモード対応準備済み

### 特徴的な実装
- 個人ポートフォリオサイト（現在工事中）
- 2024年版のアーカイブページが存在
- モバイルファーストのレスポンシブデザイン
- Suspenseを使用したアナリティクスの非同期読み込み

## 作業ルール

### Git
- main への Push は必ず許可を得てから行う
- コミットは自由に行ってよい
- Push 前にセンシティブな情報が含まれていないか確認する

### Git追跡除外ディレクトリ
- `raw_data/` - 分析用の生データ（スクリーンショット、エクスポートファイル等）。センシティブな情報を含む可能性があるため追跡しない
- `docs/tmp/` - 一時的な作業ファイル

### 分析・調査
- 一次ソース（元データ）での検証を重視する
- 外部の事実より、分析対象から読み取れる情報を優先する
- 事実に基づかない推測は、確認するか「推測」と明示する

### 方法論提案
- 設計・実装の方法論を提案する際は、根拠となる思想や原則を明示する
- 公式ドキュメントへのリンクを添える
- 例: 「Atomic Design に基づき...」→ [公式サイト](https://atomicdesign.bradfrost.com/)

### ドキュメント更新の検知

#### チェックタイミング
- タスク完了時
- セッション終了前

#### 検知の契機
- すべてのコード変更

#### 更新対象ドキュメント
- docs/ ディレクトリ全体（特に ROADMAP.md）
- CLAUDE.md
- ADR（重要な決定がある場合）

#### 検知すべき変化
- ステータス変化（⏳→✅）
- パス・参照の不整合（ファイル移動・削除によるリンク切れ）
- 技術スタック変更（依存関係や構成の変更）
- 新規ドキュメントの必要性（新機能や重要な決定）

#### 行動方針
- 更新の必要性を検知したら提案のみ行う（実行は許可を得てから）

## コミュニケーション

### 基本スタイル
- 日本語で応答する
- 「はい」は同意・続行の合図。詳細確認は不要
- 意見を求められたら率直に答える

### 質問形式
- 質問は `AskUserQuestion` ツールを使用したウィザード形式で行う
- 推測を含む判断は都度確認する

### エラー対応
- 誤りがあった場合は原因を説明する（解釈ミス / ソースの曖昧さ / その他）
- 修正指示は簡潔に来ることが多い。詳細は必要に応じて確認する