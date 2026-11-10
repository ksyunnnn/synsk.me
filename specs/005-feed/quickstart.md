# Quickstart: 一覧

005 が動くことを確かめる手順。経路と DTO は [contracts/visitor-feed.md](./contracts/visitor-feed.md) が、ビューの列と腕は [data-model.md](./data-model.md) が持つ。

## 前提

- 共有担当のビューの migration（確かめる段階までの M1〜M5）が入っている
- `npm ci` を済ませている
- 検査の値はすべて作り物

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | ビューの行から `FeedItem` への詰め替えが種類ごとの項目だけを持つ。種類の順の配列から作る並べ方 |
| workerd | `npm run test:workers` | ビューと Repository の実装が本物の migration の上で動く。並ぶ行の条件、並びの日付と順、秘匿化した値、転載先の除外 |
| 結合 | `npm run test:integration` | 一覧の HTML と RSC の応答に、秘匿化した実際の値・サイトに載せない行・学歴・下書きの note が無い |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手で確かめる（ブランチの Preview）

Preview は全体が Access の後ろにあり、D1 は本番と分けた `synsk-me-preview` を使う（README.md の「開発」）。

1. `npm run build` が通る
2. オーナーとして `/dash/organizations` で作り物の組織に秘匿化した組織名を入れ、`/dash/careers/new` でその組織の職歴を、秘匿化してサイトに載せるにして保存する。`/dash/projects/new` で同じ組織の実績を、秘匿化しないでサイトに載せるにして保存する
3. 一覧の画面（plan.md の U1 の URL）を開き、実績と職歴が始まりの日の新しい順に並ぶ。職歴は秘匿化した組織名で並び、本文の場所に「非公開」が出る。実績は実際の題と組織名で並ぶ
4. 職歴をサイトに載せないにして保存し、一覧を開き直すと職歴が並ばない
5. 学歴を登録しても一覧に並ばない
6. note・外部の activity・life event の段階（tasks.md の Phase 4・Phase 6・Phase 7）を終えたら、公開の note・取り込んだ外部の activity・life event が同じ並びに入り、転載先と同じ URL の外部の activity が並ばない
