# Quickstart: 外部 activity の取得

004 が動くことを確かめる手順。経路と DTO は [contracts/](./contracts/) が、決まりは [data-model.md](./data-model.md) が持つ。

## 前提

- 共有担当の migration（`activity.uid` と取得元の行）が入っている
- `npm ci` を済ませている
- 検査の値はすべて作り物。取得元の応答も作り物を使い、検査から外へ要求を出さない。Preview の手順だけが実在の取得元へ要求を出す

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | 取得元ごとの詰め替え、`planRefresh`（同じ項目・公開日の保持・消す候補・上限）、`refreshSources`（1 つの失敗でほかを止めない）、登録のユースケース、proxy の rewrite |
| workerd | `npm run test:workers` | Repository の実装が本物の migration の上で動く。取得元ごとの `batch()`、`fetch_result` の上書き、life event の行を書かない、slug の重複 |
| 結合 | `npm run test:integration` | `/life-events/{slug}` の 200・404 と応答の中身、JWT のない書き込みが何も書かない |
| E2E | `npm run test:e2e` | オーナーとしての life event と外部の activity の登録・編集・削除と、キーボードだけの操作 |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手で確かめる（ブランチの Preview）

Preview は全体が Access の後ろにあり、D1 は本番と分けた `synsk-me-preview` を使う（README.md の「開発」）。

1. `npm run build` が通り、`dist/server/wrangler.json` の `triggers.crons` に research.md の R8 の間隔がある（配備はこのファイルを読む）
2. オーナーとして `/dash/life-events/new` を開き、題「作り物の出来事」・起きた日 2020-04-01 で、識別子を入れずに保存する
3. 保存した life event の識別子で `/life-events/{識別子}` を開き、題と起きた日が出る
4. 起きた日を空にして保存すると、保存されずに理由が出る
5. `/dash/activities/new` で取得元 Spotify と実在するプレイリストの URL と日付を入れて保存し、題が入る。日付を空にすると保存されない

## 手で確かめる（手元の取得）

Preview では Cron Triggers の `scheduled` を起こせない。手元の D1 に migration を当て（README.md の「開発」）、`npm run preview` を起動し、`scheduled` を HTTP で起こす（[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) の「Test Cron Triggers locally」）。実在の取得元へ要求を出す。

1. `curl "http://localhost:8787/cdn-cgi/local/scheduled"` で取得を走らせる。`fetch_result` に取得元ごとの行があり、Zenn の記事が `activity` に入る
2. `fetch_result` の `ETag`・`Last-Modified` の列を NULL にしてから、もう一度走らせる。行が増えない（FR-008。値を残すと 304 になり、同じ項目の判定を通らない）
3. 値を残したまま、もう一度走らせる。304 を返した取得元の `activity` が変わらず、`fetch_result` が成功になる
