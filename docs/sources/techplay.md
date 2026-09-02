# TECHPLAY

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `unavailable` |
| 経路 | なし |
| エンドポイント | — |
| 認証 | — |
| 公式性 | — |
| レート制限 | — |
| 出典 | https://techplay.jp/robots.txt |
| 件数 | — |
| 実測日 | 2026-09-02 |

公開 API もユーザー単位のフィードも存在しない。提供されているのはサイト全体の新着イベント RSS `https://rss.techplay.jp/event/w3c-rss-format/rss.xml` の 1 本のみで、`?keyword=` を付けてもレスポンスが 1 バイトも変わらない。`robots.txt` は全 UA に `Disallow: /user/*` を課している。

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| ユーザー単位のすべて | API もフィードも存在せず、ユーザーページが 404 | 実測 2026-09-02 |
| 全体 RSS の絞り込み | `?keyword=` が無効 | 実測 2026-09-02 |

記事本文には techplay.jp と前身の eventdots.jp への URL が 14 件ある。主催コミュニティは `MoquMoquCOM`。connpass だけでは 2017 年の主催歴が欠ける。
