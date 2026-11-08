# Quickstart: 外部 activity の取得

004 が動くことを確かめる手順。経路と DTO は [contracts/](./contracts/) が、決まりは [data-model.md](./data-model.md) が持つ。例の値はすべて作り物。

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | 取得元ごとの詰め替え、消えたかの候補と上限、取得と登録のユースケース、life event の決まり、proxy の rewrite |
| workerd | `npm run test:workers` | Repository の実装が本物の migration の上で動く。同じ項目を 2 行にしない・値の変わらない行を書かない・`last_succeeded_at` が残る・life event の削除で `media` が残らない |
| 結合 | `npm run test:integration` | `/life-events/{slug}` の 200・404、`/dash/activities`・`/dash/life-events` の 403 と `no-store`、JWT のない書き込みが何も書かない |
| E2E | `npm run test:e2e` | オーナーとしての life event と手で入力する activity の登録・編集・削除、キーボードだけの操作 |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手元で取得を走らせる

1. `npx wrangler d1 migrations apply synsk-me --local`
2. `npm run build`
3. `npx wrangler dev --config dist/server/wrangler.json --test-scheduled`
4. 取得の枠は `scheduledTime` の時で決まる（[contracts/fetch.md](./contracts/fetch.md)）。`/cdn-cgi/local/scheduled?cron=0+*+*+*+*&time=<ミリ秒>` を開き、`time` で枠を選ぶ（例: UTC の 0 時台は Zenn）
5. `/dash/activities` の取得の結果の表に、取り直した日時と成否が出る

## 手で確かめる（ブランチの Preview）

1. オーナーとしてログインし、`/dash/life-events/new` で題「作り物の出来事」・起きた日 2020-04-01 を入れて保存する
2. 編集の画面の「訪問者に見せるページを開く」で `/life-events/{識別子}` を開き、題と起きた日が出る
3. `/dash/activities/new` で、取得元「登録していないサイト」、URL `https://example.com/fake-article`、題「作り物の記事」、日付 2024-05-01 を入れて保存する
4. `/dash/activities` に 3 の activity が出る。削除の画面から消すと一覧から消える
