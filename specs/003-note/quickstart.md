# Quickstart: note

003 が動くことを確かめる手順。経路と DTO は [contracts/](./contracts/) が、決まりは [data-model.md](./data-model.md) が持つ。

## 前提

- 共有担当の migration（`note.uid`・`note_revision.uid`）、書きかけの保持の部品、slug の形の検査が `epic/219-complete-specs` に入っている（tasks.md の「共有担当と 001 への依存」）
- `npm ci` を済ませている
- 例の値はすべて作り物

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | 識別子・題・本文の長さ、公開の判定、本文の読み方（画像の id・カードにする行・説明）、ユースケースのオーナーの確認、proxy の rewrite |
| workerd | `npm run test:workers` | Repository の実装が本物の migration の上で動く。版の追加と同時編集の判定・公開と下書きに戻す・削除と元に戻す・完全に消す・転載先・参照先の情報 |
| 結合 | `npm run test:integration` | `/notes/*` の 200・404 と応答の中身（SC-001・SC-004）、本文の HTML が要素にならないこと、`/dash/notes` の 403、JWT のない書き込みが何も書かないこと、管理画面に主キーが出ないこと |
| E2E | `npm run test:e2e` | オーナーとしての作成から公開まで、同時編集、書きかけの保持、キーボードだけの操作、スマートフォンの端末の設定 |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手で確かめる（ブランチの Preview）

Preview は全体が Access の後ろにある（README.md の「開発」）。ログインしていない訪問者の応答を確かめるのは結合の検査が持つ。

1. `npm run build` が通る
2. Preview の D1 に migration が当たっている
3. `/dash/notes/new` で識別子 `sample-note`・題・説明文・本文（見出しと箇条書きを含む Markdown）を入れて作る。一覧に下書きで出る
4. 題を空にして保存し、公開を押すと公開されず、題を入れるよう示される
5. 題を入れて保存し、公開する。`/notes/sample-note` で題・説明文・本文が Markdown として出る
6. 本文を直して保存し、公開し直さずに `/notes/sample-note` を開くと直す前の本文が出る。公開し直すと直した本文が出る
7. 識別子の入力が読み取りだけになっている
8. 版の一覧に版が並び、1 つ目の版に戻すと新しい版として足される
9. 2 つのタブで同じ note を開き、片方で保存した後にもう片方で保存すると、保存されずに入力が残り、知らせが出る
10. 本文を書きかけて保存せずに再読み込みすると、書きかけの内容が残る
11. 下書きに戻す・削除する・元に戻すのそれぞれの後に `/notes/sample-note` の状態が変わる
12. 転載先の URL を 2 つ記録できる。同じ URL を別の note に記録すると拒まれる
13. スマートフォンで 3〜5 を行える
14. 本文に、OGP を持つ記事の URL だけの行を書いて保存し、見た目の確認を開くと、題と画像を添えたカードで出る。引けない名前の URL（例: `https://sample.invalid/a`）の行は URL の文字列のリンクで出る

## 版の大きさを測る（research.md の R17）

Preview か本番の D1 に対して、`wrangler d1 execute` で次の SQL を流す。返るのは note ごとの版の数と、本文の文字数の合計。版を扱う仕組みは、この値が閾値を割ってから決める。

```sql
SELECT note_id, count(*) AS revisions, sum(length(body)) AS body_chars
FROM note_revision GROUP BY note_id ORDER BY body_chars DESC;
```

## 参照先の情報の行を測る（research.md の R13）

本文から消えた URL の行も `link_preview` に残す。同じく次の SQL を流す。返るのは行の数と、題と画像の URL の文字数の合計。行を消す仕組みは、この値が閾値を割ってから決める。

```sql
SELECT count(*) AS rows, sum(length(coalesce(title, '')) + length(coalesce(image_url, ''))) AS chars
FROM link_preview;
```
