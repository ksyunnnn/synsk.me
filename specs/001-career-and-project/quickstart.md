# Quickstart: 職歴と実績

001 が動くことを確かめる手順。経路と DTO は [contracts/](./contracts/) が、決まりは [data-model.md](./data-model.md) が持つ。

## 前提

- `migrations/0008_rebuild_career_project_and_resume.sql` と `migrations/0009_add_status_to_career_and_project.sql` がある
- `npm ci` を済ませている
- 例の値はすべて作り物

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | 秘匿化の DTO・識別子の決まり・期間の計算・作り手の判定・proxy の rewrite |
| workerd | `npm run test:workers` | Repository の実装が本物の migration の上で動く。楽観ロック・削除の順序・秘匿化した実績で隠す列を読まない |
| 結合 | `npm run test:integration` | `/projects/{slug}` の 200・404 と応答の中身（SC-001）、`/dash` の 403 と `no-store`、JWT のない書き込みが何も書かない |
| E2E | `npm run test:e2e` | 作り手としての登録・編集・削除と、キーボードだけの操作 |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手で確かめる（ブランチの Preview）

Preview は全体が Access の後ろにあり、D1 は本番と分けた `synsk-me-preview` を使う（README.md の「開発」）。

1. `npm run build` が通る
2. Preview の D1 に migration が当たっている
3. オーナーとしてログインし、`/dash/projects/new` を開き、組織名「作り物株式会社」（秘匿化した組織名「ある会社」）、題「作り物の受託開発」、秘匿化した題「業務システムの開発」で、秘匿化を変えずに保存する
4. 保存した実績の識別子が uid であることを確かめ、`/projects/{識別子}` を開く。「業務システムの開発」と「ある会社」が出て、「作り物の受託開発」「作り物株式会社」が HTML に無い
5. 秘匿化を外して保存し、同じ URL で実際の題と組織名が出る
6. 存在しない識別子の `/projects/{識別子}` が 404 を返す
7. 2 つのタブで同じ実績を開き、片方で保存した後にもう片方で保存すると、保存されずに入力が残り、知らせが出る
