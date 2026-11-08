# Quickstart: 一覧

005 が動くことを確かめる手順。経路と DTO は [contracts/visitor-feed.md](./contracts/visitor-feed.md) が、ビューの決まりは [data-model.md](./data-model.md) が持つ。例の値はすべて作り物。

## 検査を回す

| 段階 | コマンド | 確かめること |
|---|---|---|
| 単体 | `npm test` | ページの番号の読み方、ビューの行から DTO への詰め替え |
| workerd | `npm run test:workers` | ビューと Repository が、出す条件・秘匿化した値・並び・転載先の除外を満たす |
| 結合 | `npm run test:integration` | `/timeline` の HTML に秘匿化した実際の値・下書きの note・学歴が含まれない。`no-store` |
| E2E | `npm run test:e2e` | 一覧の並びと、キーボードでリンクを辿れること |
| 型・lint・整形 | `npx tsc --noEmit`、`npm run lint`、`npm run format:check` | 0 件 |

## 手で確かめる（ブランチの Preview）

1. オーナーとしてログインし、note・life event・実績・職歴を 1 件ずつ作る。実績と職歴は「サイトに載せる」にし、note は公開する
2. `/timeline` を開くと、4 件が並びの日付の新しい順に並ぶ
3. 実績を秘匿化すると、`/timeline` のその実績が秘匿化した題と秘匿化した組織名で出て、本文の場所に「非公開」と出る
4. note を下書きに戻すと、`/timeline` から消える
