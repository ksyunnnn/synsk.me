# Quickstart: note

003 が動くことを確かめる手順。経路と DTO は [contracts/](./contracts/) が、決まりは [data-model.md](./data-model.md) が持つ。

## 前提

- `migrations/0015_add_uid_to_note.sql` がある
- `npm ci` を済ませている
- 例の値はすべて作り物

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | 版の番号の決まり・入力の読み方・画像の形式と上限・カードにする URL の取り出し・参照先の HTML の読み取り・proxy の rewrite |
| workerd | `npm run test:workers` | Repository の実装が本物の migration の上で動く。版の保存の衝突・公開と下書きと削除の移り方・訪問者向けの取り出しが公開した版だけを読む・配る画像の条件・完全に消す |
| 結合 | `npm run test:integration` | `/notes/{slug}` の 200・404 と応答の中身（SC-001）、画像の 404、`/dash/notes` の 403 と `no-store`、JWT のない書き込みが何も書かない |
| E2E | `npm run test:e2e` | オーナーとしての作成から公開・削除・版の戻しまで、2 つの画面の保存の衝突、書きかけの内容の保持、スマートフォンの幅、キーボードだけの操作 |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手で確かめる（手元）

1. `npx wrangler d1 migrations apply synsk-me --local` で表を作る
2. `npm run dev` で起動し、オーナーとして `/dash/notes/new` を開き、識別子「sample-note」、題「作り物の note」で作る
3. 本文に段落を書き、画像を 1 枚追加して `![図](media:…)` を本文に貼り、保存する。`/dash/notes/{uid}/preview` に画像が出る <!-- check-ignore: 本文に書く書き方の例で、リンクではない -->
4. 「公開する」を押し、`/notes/sample-note` に題・本文・画像が出る
5. 本文を直して保存し、公開し直さずに `/notes/sample-note` を開くと、直す前の本文が出る
6. 「下書きに戻す」を押すと、`/notes/sample-note` が 404 になる
7. 2 つのタブで同じ note を開き、片方で保存した後にもう片方で保存すると、保存されずに入力が残り、知らせが出る
