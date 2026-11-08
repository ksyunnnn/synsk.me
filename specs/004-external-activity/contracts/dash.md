# Contract: 管理画面と書き込みの操作

## 共通

001 の [contracts/dash.md](../../001-career-and-project/contracts/dash.md) の「共通」と同じ。`/dash` 配下は `src/proxy.ts` と各画面・各 Server Action がオーナーを確かめ、応答に `Cache-Control: no-store, must-revalidate` を付ける。行は uid で開き、主キーを URL とフォームに出さない。

## 画面

| 経路 | 中身 | 要件 |
|---|---|---|
| `/dash/activities` | 取得元ごとの取得の結果の表と、外部の activity の一覧（新しい順）。一覧は取得元・題・日付・取り込み方を出す | FR-016、research.md の R13 |
| `/dash/activities/new` | URL を指名する・手で入力する activity の登録 | FR-009〜FR-011 |
| `/dash/activities/{uid}` | URL を指名した activity の日付、手で入力した activity の URL・題・日付の編集。一覧を取る activity は値を出すだけ | FR-012・FR-022・FR-031 |
| `/dash/activities/{uid}/delete` | URL を指名した・手で入力した activity の削除の確認。一覧を取る activity は削除できないと出す | FR-033 |
| `/dash/life-events`、`/dash/life-events/new`、`/dash/life-events/{uid}`、`/dash/life-events/{uid}/delete` | life event の一覧・作成・編集・削除の確認 | FR-023〜FR-027・FR-035 |

## Server Action

| 名前 | 入力 | 成功 | 失敗の理由 |
|---|---|---|---|
| `registerActivity` | 取得元・URL・日付・題（手で入力する取得元だけ） | 編集の画面へ 303 | オーナーでない／取得元の不備／URL がその取得元のものでない／日付が無い／題が無い（手で入力）／取得元から取れない・題を返さない（URL を指名）／同じ項目がある |
| `editActivity` | uid と、日付（URL を指名）か URL・題・日付（手で入力） | 同じ画面へ 303 | オーナーでない／一覧を取る activity／項目の不備／同じ項目がある |
| `deleteActivity` | uid | 一覧へ 303 | オーナーでない／一覧を取る activity |
| `registerLifeEvent` | 題・説明・起きた日 | 編集の画面へ 303 | オーナーでない／題が無い／起きた日が無いか読めない |
| `editLifeEvent` | uid・題・説明・起きた日・識別子 | 同じ画面へ 303 | 上に加えて、識別子の形／識別子の重複 |
| `deleteLifeEvent` | uid | 一覧へ 303 | オーナーでない |

## 検査

- 結合: JWT のない `/dash/activities`・`/dash/life-events` の GET が 403 で、`no-store` を持つ
- 結合: JWT のない各 Server Action の呼び出しが 403 の結果を返し、`activity` の行が変わらない（constitution I）
- 結合: 管理画面のリンク・redirect 先・隠しフィールドに主キーが出ない（`tests/integration/dash-url-without-id.test.ts` に life event と外部の activity の行を足す）
- E2E: オーナーとして、life event を作り・書き換え・消せる。手で入力する activity を登録し、消せる。キーボードだけで操作できる（constitution V）
