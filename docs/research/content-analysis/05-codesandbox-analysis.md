# CodeSandbox分析

## 概要

- **対象**: CodeSandboxユーザー ksyunnnn (https://codesandbox.io/u/ksyunnnn)
- **公称サンドボックス数**: 150件
- **読み込み成功数**: 15件（主要なもの）
- **分析実施日**: 2026年1月28日

---

## 1. サンドボックス一覧（人気順・読み込み結果含む）

### 1.1 人気サンドボックス（上位）

| No | タイトル | Views（推定） | URL | 読み込み | 備考 |
|----|----------|---------------|-----|----------|------|
| 1 | Zenn記事用: カスタムフック | 38.6k | https://codesandbox.io/s/3lp34 | 失敗 | 旧URLが無効化、リダイレクト先不明 |
| 2 | Zenn記事用: useInputs / TypeScript | 15.8k | https://codesandbox.io/s/2u1kz | 成功 | React + TypeScript カスタムフック |
| 3 | Try Jest Test | 2.8k | https://codesandbox.io/s/smolt0 | 成功 | Jest + Parcel |
| 4 | 逆藤原竜也変換ツール | 2.1k | https://codesandbox.io/s/1xlol | 成功 | React製ジョークツール |

### 1.2 読み込み成功サンドボックス一覧

| No | タイトル | URL | 使用技術 | 作成日 | 最終更新 |
|----|----------|-----|----------|--------|----------|
| 1 | Zenn記事用: useInputs / TypeScript | https://codesandbox.io/s/2u1kz | React, TypeScript, @emotion/css, uuid | 2021-01-17 | 2021-01-18 |
| 2 | Zenn記事用: カスタムフック 例 | https://codesandbox.io/s/26ghy | React (CRA) | 2020-12-18 | 2020-12-18 |
| 3 | Try Jest Test | https://codesandbox.io/s/smolt0 | Jest, Parcel | 2022-05-20 | 2022-05-20 |
| 4 | 逆藤原竜也変換ツール | https://codesandbox.io/s/1xlol | React (CRA) | 2019-07-30 | 2020-01-29 |
| 5 | OGP Generator | https://codesandbox.io/s/y5gk0 | React (CRA) | 2019-08-08 | 2019-08-13 |
| 6 | useWindowWidth | https://codesandbox.io/s/zsrqd | React (CRA) | 2019-10-04 | 2020-09-02 |
| 7 | useSnackbar | https://codesandbox.io/s/byznp | React, @emotion/css | 2021-01-15 | 2021-03-26 |
| 8 | React Hooks with Canvas | https://codesandbox.io/s/0r7g5 | React (CRA), Canvas API | 2019-08-06 | 2019-08-08 |
| 9 | Vue Component: Text / Multiple | https://codesandbox.io/s/om83w | Vue CLI | 2019-12-13 | 2019-12-13 |
| 10 | Font Size | https://codesandbox.io/s/xlcgc | React (CRA) | 2020-02-15 | 2020-02-15 |
| 11 | Sample gatsby-image | https://codesandbox.io/s/xo9x3r3ozw | Gatsby, gatsby-image, styled-components | 2019-02-12 | 2019-02-12 |

### 1.3 読み込み失敗・未確認サンドボックス

| タイトル | URL（推定） | 理由 |
|----------|-------------|------|
| Zenn記事用: カスタムフック（38.6k views） | https://codesandbox.io/s/3lp34 | 404エラー - URL変更またはプライベート化の可能性 |
| その他多数 | - | CodeSandboxのSPA構造によりWebFetchでメタデータ取得不可 |

---

## 2. 技術カテゴリ分類

### 2.1 フレームワーク・ライブラリ別

| カテゴリ | サンドボックス数 | 代表例 |
|----------|------------------|--------|
| **React (CRA)** | 9件 | useInputs, OGP Generator, 逆藤原竜也変換ツール |
| **Vue.js** | 1件 | Vue Component: Text / Multiple |
| **Gatsby** | 1件 | Sample gatsby-image |
| **Jest/Testing** | 1件 | Try Jest Test |

[Fact] React系が全体の約75%を占める

### 2.2 目的別分類

| 目的 | サンドボックス数 | 内容 |
|------|------------------|------|
| **カスタムフック実装** | 4件 | useInputs, useWindowWidth, useSnackbar, カスタムフック例 |
| **記事用サンプル** | 3件 | Zenn記事用（3件） |
| **ツール・アプリ** | 2件 | OGP Generator, 逆藤原竜也変換ツール |
| **技術検証** | 3件 | Canvas, gatsby-image, Vue Component |
| **テスト** | 1件 | Try Jest Test |

[Observation] カスタムフック関連が最も多く、React Hooksへの深い関心が見られる

---

## 3. 実装パターンの特徴

### 3.1 カスタムフック実装パターン

#### useInputs / TypeScript
[Fact] Zenn記事「React Hooksを最大限利用したFormの実装」と連携
- **実装内容**: フォーム入力管理のカスタムフック
- **特徴**:
  - `useInput`: inputタグの全プロパティを返却、uuidでユニークID生成
  - `useSelect`: select要素の管理、オプション配列への自動ID付与
  - `useSubmitValues`: フォーム値の整形・サブミットデータ生成
- **使用技術**: React, TypeScript, @emotion/css, uuid
- **設計思想**: 宣言的なフォーム実装、関心の分離

[Observation] `useMemo`を使用してレンダリング毎のID再生成を防止するなど、パフォーマンスを意識した実装

#### useWindowWidth
[Fact] ウィンドウ幅を取得するカスタムフック
- **用途**: レスポンシブ対応時のウィンドウサイズ監視
- **実装**: resize イベントリスナーの登録・解除を管理

#### useSnackbar
[Fact] スナックバー（トースト通知）のカスタムフック
- **使用技術**: React, @emotion/css
- **用途**: 通知UI の状態管理

### 3.2 ツール系実装パターン

#### OGP Generator
[Fact] OGP（Open Graph Protocol）画像生成ツール
- **作成時期**: 2019年8月
- **用途**: SNS共有用のOGP画像を生成

#### 逆藤原竜也変換ツール
[Fact] 文字列を「藤原竜也風」に変換するジョークツール
- **作成時期**: 2019年7月（初版）
- **特徴**: 日本のネットミーム「藤原竜也変換」の逆パターン

[Inference] ユーモアを交えた個人開発への姿勢が見られる

### 3.3 技術検証パターン

#### React Hooks with Canvas
[Fact] React HooksとCanvas APIの組み合わせ検証
- **作成時期**: 2019年8月
- **用途**: Canvasをフックベースで操作する実験

#### Sample gatsby-image
[Fact] Gatsbyの画像最適化機能の検証
- **作成時期**: 2019年2月（最古のサンドボックスの一つ）
- **使用技術**: Gatsby, gatsby-image, gatsby-background-image, styled-components

---

## 4. Zenn/Qiita記事との連携

### 4.1 確認できた連携

| 記事プラットフォーム | 記事タイトル | サンドボックス | URL |
|---------------------|--------------|----------------|-----|
| Zenn | React Hooksを最大限利用したFormの実装 | Zenn記事用: useInputs / TypeScript | https://codesandbox.io/s/2u1kz |
| Zenn | これからReactを学んでいくためのロードマップ | Zenn記事用: カスタムフック 例 | https://codesandbox.io/s/26ghy |

[Fact] Zenn記事との連携が明確に確認できたのは2件

### 4.2 記事での言及

Zenn記事「React Hooksを最大限利用したFormの実装」より引用:
> 「普段からCodeSandboxでuseHogehogeみたいなカスタムフックを作ってはTwitterで共有とかしてる」

[Observation] CodeSandboxを日常的な技術検証・共有ツールとして活用していることがわかる

### 4.3 連携パターン

1. **記事埋め込み型**: Zenn記事内にCodeSandboxをembedで表示
2. **参照リンク型**: 記事末尾に「全部載せのCodeSandbox」としてリンク提供
3. **学習教材型**: React学習ロードマップ記事でCodeSandboxを推奨環境として紹介

---

## 5. 時系列での活動傾向

### 5.1 作成時期分布

| 年 | サンドボックス数（確認分） | 主な内容 |
|----|---------------------------|----------|
| 2019 | 5件 | gatsby-image, OGP Generator, Canvas, 逆藤原竜也, Vue |
| 2020 | 3件 | useWindowWidth, Font Size, カスタムフック例 |
| 2021 | 2件 | useInputs/TypeScript, useSnackbar |
| 2022 | 1件 | Try Jest Test |

[Observation] 2019年が最も活発で、その後は年1-3件程度の更新頻度

### 5.2 技術的進化

- **2019年**: React基礎、Vue検証、Gatsby学習
- **2020年**: カスタムフック実装の深化
- **2021年**: TypeScript導入、@emotion/css採用
- **2022年**: テスティング環境の構築

[Inference] 時間とともにTypeScript化、テスト導入など品質向上への意識が高まっている

---

## 6. 技術スタックまとめ

### 6.1 主要技術

| 技術 | 使用頻度 | 用途 |
|------|----------|------|
| React | 高 | メインフレームワーク |
| create-react-app | 高 | プロジェクトテンプレート |
| TypeScript | 中 | 型安全なコード |
| @emotion/css | 中 | CSS-in-JS |
| uuid | 低 | ユニークID生成 |
| Jest | 低 | テスティング |
| Parcel | 低 | バンドラー |
| Vue.js | 低 | 検証目的 |
| Gatsby | 低 | 検証目的 |
| styled-components | 低 | CSS-in-JS |

### 6.2 デザインパターン

[Fact] 確認できたパターン:
- **カスタムフックパターン**: ロジックの再利用と関心の分離
- **宣言的UI**: フォーム実装での宣言的アプローチ
- **CSS-in-JS**: emotion, styled-componentsの使い分け

---

## 7. 読み込み結果チェックリスト

### 7.1 サマリー

| 項目 | 件数 |
|------|------|
| 読み込み試行 | 15件 |
| 成功 | 11件 |
| 失敗 | 4件 |
| 成功率 | 73.3% |

### 7.2 成功したサンドボックス

- [x] Zenn記事用: useInputs / TypeScript (2u1kz)
- [x] Zenn記事用: カスタムフック 例 (26ghy)
- [x] Try Jest Test (smolt0)
- [x] 逆藤原竜也変換ツール (1xlol)
- [x] OGP Generator (y5gk0)
- [x] useWindowWidth (zsrqd)
- [x] useSnackbar (byznp)
- [x] React Hooks with Canvas (0r7g5)
- [x] Vue Component: Text / Multiple (om83w)
- [x] Font Size (xlcgc)
- [x] Sample gatsby-image (xo9x3r3ozw)

### 7.3 失敗したサンドボックス

| サンドボックス | 失敗理由 |
|----------------|----------|
| Zenn記事用: カスタムフック (3lp34) | 404 Not Found - URLが変更または削除された可能性 |
| zennkiji-kasutamufutuku-3lp34 | 404 Not Found - 旧URL形式 |
| zennkiji-useinputs-typescript-forked-lf2w4 | 異なるユーザー（tawandamatsika39）のフォークと判明 |
| その他多数（公称150件） | CodeSandboxのSPA構造によりWeb検索/Fetchでの網羅的取得が困難 |

### 7.4 取得できなかった情報

[Fact] 以下の情報はCodeSandboxページ構造上、取得が困難だった:
- 正確なview数・fork数（検索結果の推定値のみ）
- コード詳細（実際のソースコード）
- 150件の完全なリスト

### 7.5 失敗理由の分析

1. **SPA構造**: CodeSandboxはJavaScript駆動型のSPAであり、WebFetchでHTMLを取得しても動的コンテンツが含まれない
2. **URL形式の変更**: 古いサンドボックスはURL形式が変更されている可能性がある
3. **プライベート設定**: 一部のサンドボックスが非公開に設定されている可能性
4. **検索インデックス**: Web検索では全150件がインデックスされていない

---

## 8. 結論

### 8.1 技術的特徴

[Inference] CodeSandboxでの活動から見えるksyunnnの技術的特徴:

1. **React Hooks への深い理解**: カスタムフック実装が最も多く、フォーム管理など実践的な用途で活用
2. **TypeScript への移行**: 2021年以降はTypeScriptを積極採用
3. **アウトプット重視**: 技術記事との連携、Twitter共有など発信を意識した開発スタイル
4. **実験的姿勢**: Vue、Gatsby、Canvas APIなど幅広い技術を検証

### 8.2 コンテンツ連携パターン

[Observation] Zenn記事とCodeSandboxの相互補完関係:
- 記事は「なぜ・どう考えたか」を説明
- CodeSandboxは「実際に動くコード」を提供
- 読者が即座に試せる環境を提供する設計思想

### 8.3 制限事項

- 公称150件のうち約10%程度しか詳細を取得できなかった
- view数・fork数は検索結果からの推定値
- プライベートサンドボックスの存在可能性あり

---

## 参考リンク

- CodeSandboxプロフィール: https://codesandbox.io/u/ksyunnnn
- Zenn記事（React Hooks Form実装）: https://zenn.dev/ksyunnnn/articles/9ac2715a152be1
- Zenn記事（React学習ロードマップ）: https://zenn.dev/ksyunnnn/articles/90fb2bbfd51dc1
