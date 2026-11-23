---
name: designing-ui
description: Designs and implements screen UI and interaction from sourced guidelines (the repository's conventions, then Apple HIG, then Liquid Glass), using object-oriented UI (OOUI) to structure screens. Use when asked to redesign or build a screen, improve its UX, choose components, style with Liquid Glass, or review a UI by operating it.
---

# Designing UI

画面の構造と見た目を、出典のある指針から決めて実装し、操作して確かめる。好みで決めない。

## 出典の優先順位

1. リポジトリの規約（`docs/PRINCIPLES.md`・`design/guidelines.md`・`docs/VISION.md`・ADR）
2. Apple Human Interface Guidelines（HIG）
3. Liquid Glass の技術概要と WWDC のセッション

判断のたびに、使った出典の名前と URL を添える。出典で決まらないものは、ユーザーに選択肢として出す。場面ごとの出典は [reference/sources.md](reference/sources.md) にある。

## 手順

この順に進め、各段の終わりで記録する（issue のコメントなど、ユーザーが指定した場所）。

```
- [ ] 1. 宣言: 目的・拠り所・期待を書いてから始める
- [ ] 2. 明文化: OOUI の 3 段階で、画面がどう操作できるべきかを短く書き、承認を得る
- [ ] 3. 部品の土台: headless のライブラリと、見た目の指針を決める
- [ ] 4. 小さく作って見せる: 1 画面の骨格を作り、テストより先に画面を見せる
- [ ] 5. 広げる: 共通の部品にして、ほかのオブジェクトへ広げる
- [ ] 6. 操作して確かめる: UX として操作し、引っかかった点を直す
- [ ] 7. 検査と PR: lint・整形・型・関わるテストをまとめて回し、PR を作る
```

### 2. 明文化

[reference/ooui.md](reference/ooui.md) の 3 段階（オブジェクトとスコープ／ビュー／アクションとインタラクション）で書く。画面単位で書かない。決まらない点は「未決」として残し、実装した画面で決めてよいかを聞く。

### 3. 部品の土台と見た目

- 操作・フォーカス・キーボードは headless のライブラリに任せ、見た目だけをかぶせる
- ガラスの決まりは [reference/glass.md](reference/glass.md) に従う
- 足した値（色・ぼかし・影など）は、foundations にない値として一覧にし、レビューの対象にする
- 色は、白い文字で WCAG AA（4.5:1）を満たす値を選び、比を計算して添える

### 4. 小さく作って見せる

- 1 つのオブジェクトの一覧と詳細だけを作り、スクリーンショットか Preview の URL で見せて止まる
- 見せた後の意見（色が単調、フォームも対象に、など）は、次の段の範囲に入れる

### 6. 操作して確かめる

機能のテストではなく、使い心地として操作する。ブラウザは画面を出さずに動かす（例: `npx -y @playwright/cli@latest`）。

```
- [ ] 一覧で選ぶ → 詳細が切り替わる。選んだ行の強調が残る
- [ ] 直して保存せずに別の 1 件を選ぶ → 直しかけが残り、印が出る
- [ ] 保存する → その 1 件を選んだ一覧に戻り、印が消える
- [ ] 再読み込み・外へのリンク → 直しかけがあるときだけ確かめる
- [ ] 見せ方の切り替え・絞り込み → メニューが閉じ、条件と件数が出る
- [ ] 狭い画面（幅 390px）→ シート・ナビ・表が詰まって読める
- [ ] ガラスの上にガラスが重なっていない
- [ ] コンソールにエラーが出ていない
```

見つけた点は、直してからもう一度同じ操作で確かめる。

## してはいけないこと

- コードの値だけで、余白や文字を指摘する（画面を撮って見る）
- 本文の面（表・詳細）にガラスを使う
- 承認していない案を、確定として記録する
- 同じコードに、検査を何度も回す（まとめて 1 回）
