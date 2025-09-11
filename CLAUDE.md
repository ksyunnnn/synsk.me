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
- **フォント**: Lato (Google Fonts)
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