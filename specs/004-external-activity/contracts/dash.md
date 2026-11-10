# Contract: 管理画面と書き込みの操作

## 共通

001 の [contracts/dash.md](../../001-career-and-project/contracts/dash.md) の「共通」に従う。要点だけを挙げる。

- `/dash/*` の GET は `src/proxy.ts` がオーナーを確かめ、オーナーでなければ 403。応答に `Cache-Control: no-store, must-revalidate`（NFR-09）
- Server Action は何より先に `src/shared/server/author.ts` でオーナーを確かめ、オーナーでなければ何も書かない（FR-031、constitution I）
- 書き込みは `<form action={Server Action}>` で送り、JavaScript なしでも保存できる。失敗の結果は `src/shared/domain/action-result.ts` の `ActionResult` で返す
- 行は `activity.uid` で開く（ADR-0051）。主キーと slug は管理画面の URL にもフォームにも出さない。無い uid は `src/proxy.ts` が `missing` へ rewrite する（404）
- 保存していない入力は持たない。再読み込みすると、D1 に保存した値を出す（保存していない入力を端末に残すのは note だけの要件。003 の spec の FR-018）

## 画面

| 経路 | 中身 | 要件 |
|---|---|---|
| `/dash` | 既にある入口に、life event と外部の activity を足す | — |
| `/dash/life-events`、`/dash/life-events/new`、`/dash/life-events/{uid}`、`/dash/life-events/{uid}/delete` | life event の一覧（起きた日の新しい順）・作成・編集・削除の確認。リンク先の入力を持たない | FR-023〜FR-027、FR-035 |
| `/dash/activities`、`/dash/activities/new`、`/dash/activities/{uid}`、`/dash/activities/{uid}/delete` | URL を指名した・手で入力した外部の activity の一覧・登録・編集・削除の確認。一覧を取る取得元の activity は出さない | FR-009〜FR-011、FR-022、FR-031、FR-033 |

取得の結果をオーナーに見せる画面は持たない（spec の「決定が無く、この spec では決めない」）。

## Server Action

| 名前 | 入力 | 成功 | 失敗の理由 |
|---|---|---|---|
| `registerLifeEvent` | 題・説明・起きた日・識別子（空なら推測できない値を入れる） | 編集の画面へ 303 | オーナーでない／題が無い（FR-024）／起きた日が無い・形が違う（FR-025）／識別子の形・重複（FR-035） |
| `editLifeEvent` | 上に加えて uid | 同じ画面へ 303 | 上に加えて、無い |
| `deleteLifeEvent` | uid | 一覧へ 303 | オーナーでない／無い |
| `registerExternalActivity` | 取得元・URL・日付（手で入力する取得元は題も） | 一覧へ 303 | オーナーでない／取得元が URL を指名する・手で入力する取得元でない（一覧を取る取得元の activity は登録も削除もしない。FR-022）／日付が無い（FR-011）／URL の形・ホストが取得元と違う／題を取れない（U11）／同じ URL が既にある |
| `editExternalActivity` | uid・日付（手で入力する取得元は URL と題も） | 同じ画面へ 303 | オーナーでない／無い／日付が無い |
| `deleteExternalActivity` | uid | 一覧へ 303 | オーナーでない／無い／一覧を取る取得元の activity（FR-022） |
| `registerLifeEventImage` | uid・画像のファイル | 同じ画面へ 303 | オーナーでない／無い／形式が JPEG・PNG・WebP・GIF でない／10 MB を超える（U5 の決定）。登録すると前の画像を消す |
| `removeLifeEventImage` | uid | 同じ画面へ 303 | オーナーでない／無い |

## 検査

- 結合: JWT のない書き込みの Server Action が、`activity` と `fetch_result` の行を変えない（FR-031）
- E2E: オーナーとして life event と外部の activity を登録・編集・削除し、キーボードだけで同じ操作ができる（constitution V）
