# Quickstart: note を書いて公開し、読む

この機能が動くことを確かめる手順。画面と操作の約束は [contracts/routes.md](./contracts/routes.md)、データの規則は [data-model.md](./data-model.md) にある。

## 手元で確かめる

前提: `npm ci` を済ませている。

```bash
npm test                  # 単体
npm run test:workers      # workerd の中の D1
npm run test:integration  # ビルド出力の経路
npm run test:e2e          # 作り手と訪問者の操作
```

期待する結果: 4つとも失敗が0件。

## プレビュー URL で確かめる

前提:
- Cloudflare Access の2つのアプリケーション（本番の `/dash`、プレビュー全体）が作られている（[research.md](./research.md) の R2）
- Preview の base config に、JWT の検証の設定値が入っている: `npx wrangler preview base-config secret put <変数>`
- Preview の D1 `synsk-me-preview` に `migrations/` が適用されている: `npx wrangler d1 migrations apply synsk-me-preview --remote --config wrangler.preview-migrations.jsonc`
- PR のブランチを push し、Workers Builds がプレビュー URL をコメントしている

| # | 操作 | 期待する結果 | 対応 |
|---|---|---|---|
| 1 | ログインしていないブラウザでプレビュー URL の `/dash` を開く | Access のログインの画面に移る | FR-010 |
| 2 | オーナーのメールアドレスでログインし、`/dash` を開く | note の一覧が出る | FR-014 |
| 3 | 新しい note を作る。slug `quickstart-check`、題と本文を入れて保存する | 編集の画面に移り、一覧に `下書き` と出る | US1-1 |
| 4 | 別のプライベートウィンドウで Access にログインし、プレビュー URL の `/notes/quickstart-check` を開く | 404 | US1-2、FR-011 |
| 5 | 編集の画面で「公開する」 | 公開したことが出る。4 と同じ URL を開き直すと、題・公開日・本文が出る | US1-3 |
| 6 | 題を書き換えて「保存する」 | 4 の URL は書き換える前の題のまま。一覧に、公開し直していない書き換えがあることが出る | US2-2 |
| 7 | 「公開し直す」 | 4 の URL に書き換えた題が出る。公開日は 5 と同じ | US2-3 |
| 8 | 削除の確認の画面で「削除する」 | `/dash` に移り、note の一覧から外れて、削除した note の一覧に並ぶ。4 の URL は 404 | US3-2 |
| 9 | 同じ slug `quickstart-check` で note を作ろうとする | その slug が使えないことが出る | US3-3 |
| 10 | 削除した note の一覧から戻す確認の画面を開き、「公開で戻す」 | `/dash` に移り、note の一覧に `公開` で戻る。4 の URL に 7 と同じ題・公開日・本文が出る | US3-4 |
| 11 | もう一度削除し、戻す確認の画面で「下書きで戻す」。続けて編集の画面で「公開する」 | 「下書きで戻す」の後は、note の一覧に `下書き` で戻り、4 の URL は 404。「公開する」の後は、4 の URL に題と本文が出て、公開日は 5 と同じ。確かめたら削除する | US3-5 |

## 配信後の検査

```bash
npm run verify:deploy -- <プレビュー URL>
```

期待する結果: 認証なしの要求が Access のログインへ移される検査を含め、すべて通る。プレビュー URL は Access で守られているため、service token のヘッダが要る。
