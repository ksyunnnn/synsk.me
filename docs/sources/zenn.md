# Zenn

## 経路

| 項目 | 値 |
|---|---|
| 状態 | `ok` |
| 経路 | RSS |
| エンドポイント | `https://zenn.dev/ksyunnnn/feed` |
| 認証 | 不要 |
| 公式性 | 公式（Zenn 自身が配信するフィード） |
| レート制限 | 公式記載なし。レスポンスヘッダにも `rate-*` は無い |
| 出典 | [zenn-dev/zenn-community#496](https://github.com/zenn-dev/zenn-community/issues/496) |
| 実測日 | 2026-09-02（20 件） |

公開 API は存在しない。Zenn 運営メンバーが上記 issue で「いいえ、公開しているAPIはありません」と回答している。`https://zenn.dev/api/articles?username=ksyunnnn` は 200 を返し全 25 件を取得できるが、非公式のため採らない。

## フィールド

| フィールド | 型 | 取得 | 実データ | 備考 |
|---|---|---|---|---|
| `title` | string | 常時 | オプションを渡しても渡さなくても動く関数 | |
| `link` | string | 常時 | `https://zenn.dev/ksyunnnn/articles/095c1dea25e31f` | |
| `guid` | string | 常時 | `link` と同値 | `isPermaLink="true"` |
| `pubDate` | string | 常時 | `Tue, 09 Sep 2025 08:02:10 GMT` | RFC822 |
| `description` | string | 常時 | 本文冒頭のプレーンテキスト | |
| `enclosure@url` | string | 常時 | Cloudinary 生成の OG 画像 1200x630 | タイトル文字が焼き込まれている |
| `dc:creator` | string | 常時 | こばしゅん | |

## 取れないもの

| 何が | なぜ | 出典 |
|---|---|---|
| タグ | RSS に含まれない。詳細 API のみが `topics` を返す | 実測 2026-09-02 |
| いいね数 | RSS に含まれない | 実測 2026-09-02 |
| 21 件目以降 | RSS は 20 件固定 | 実測 2026-09-02 |
