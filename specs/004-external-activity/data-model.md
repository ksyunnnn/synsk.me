# Data Model: 外部 activity の取得

表・列・型・CHECK・外部キーの正本は `migrations/` にある。この文書は、`migrations/0001`〜`0011` に共有担当の migration（`activity.uid` と取得元の行。research.md の R1）を当てたスキーマを、spec の要件と、アプリケーションが守る決まりに対応させる。列の一覧は書き写さない。

## Contents

- 表と spec の対応
- 要る migration の変更
- アプリケーションが守る決まり
- domain の型
- 訪問者向けの DTO

---

## 表と spec の対応

| 表 | spec の実体 | 004 が書くか | 主な要件 |
|---|---|---|---|
| `activity_source` | 取得元 | 書かない（行は migration が入れる） | FR-001〜FR-005 |
| `activity`（`source <> 'life_event'`） | 外部の activity | 取得のユースケースと、URL を指名する・手で入力する登録 | FR-006〜FR-013、FR-017〜FR-022、FR-033 |
| `activity`（`source = 'life_event'`） | life event | life event の管理画面 | FR-023〜FR-027、FR-034、FR-035 |
| `fetch_result` | 取得の結果 | 取得のユースケース | FR-016 |
| `media`（`activity_id` が持ち主） | life event の画像 | life event の管理画面（共有担当の `src/shared/server/media-storage.ts` 越し） | FR-027〜FR-030 |

スキーマが守る決まり（004 のコードで重ねて書かない）: 分類の 4 値（`activity_source.kind` の CHECK、FR-001）、activity 1 件ずつの分類を持たないこと（`activity` に分類の列が無い、FR-002）、同じ項目を 2 行にしないこと（`UNIQUE (source, external_id)` と部分 UNIQUE 索引 `activity_source_url`、FR-008）、life event だけが起きた日を持ち、外部の activity は URL を持つこと（`activity` の CHECK、FR-024・FR-025）、life event だけが slug を持ち、slug の形と重複（0009 の CHECK と `activity_slug`、FR-035）、外部の activity は代表画像を持たないこと（`activity` の CHECK）、life event の題が空でないこと（0021 の CHECK `life_event_with_title`、FR-024）、代表画像がその life event の画像であること（複合の外部キー、FR-029）、画像の持ち主が 1 つ（`media` の CHECK）、取得元ごとに取得の結果が 1 行（`fetch_result.source` の PRIMARY KEY、FR-016）、手で付ける値の列が無いこと（FR-021、ADR-0052 の Confirmation）。

## 要る migration の変更

004 は migration を書かない（research.md の R1）。共有担当に渡す変更は次のとおり。PM が U12 の答えを待ってから渡す（2026-11-09、PM の回答）。

| 変更 | 理由 |
|---|---|
| `activity.uid`（DB が入れる 32 文字の 16 進。UNIQUE、書き換えを拒むトリガ） | ADR-0051。`/dash/life-events/{uid}`・`/dash/activities/{uid}` が使う。0011 の形に合わせる |
| `activity_source` の行: `article` に Zenn・Qiita・dev.to・Medium、`embed` に Speaker Deck・Spotify・X・CodeSandbox・YouTube・CodePen、`other` に GitHub・connpass | spec の Assumptions の分類。`source` の値は `migrations/0012` が入れる。plan.md の取得元ごとのファイル名と同じ（例: `devto`・`speakerdeck`） |
| U12 で案 (b) を選んだときだけ: オーナーが登録した暦の日付の列 | research.md の R10 |
| `fetch_result` に、取得元が前回返した `ETag` と `Last-Modified` の列（どちらも NULL 可） | 条件付きの要求で、変わっていない取得元の中身を取り直さない（research.md の R9）。`migrations/0014` が `etag`・`last_modified` として足す。値はヘッダの文字列のままで、日時として読まない |
| `activity.gone_checked_at`（取得元で消えたかを最後に確かめた日時、NULL 可） | すべて取らない取得元で、一覧に無い activity の URL を取り直す順を決める（research.md の R6）。`migrations/0015` が足す |
| `activity.consecutive_gone_count`（取り直した URL が続けて 404 を返した回数、INTEGER NOT NULL DEFAULT 0、life event では 0） | 続けて 2 回 404 が返った activity だけを消す（research.md の R6）。`migrations/0019` が足す。コードでは `StoredItem.goneStreak` が読む値、`RefreshPlan.goneChecked` の `goneStreak` が書く値、`RefreshPlan.goneResets` が 0 に戻す行。404 で 1 足し、2xx と判定できない応答と、一覧に載った回に 0 に戻す |
| life event の題が空でない（`source <> 'life_event'` か、`trim(title) <> ''`）CHECK | FR-024（2026-11-10、オーナーが題を必須にした）。0020 と同じく life event の列の決まりをスキーマに置く。`migrations/0021` が `life_event_with_title` として足す |

取得元で消えた activity の印の列は持たない。消えたと確かめた行は消す（research.md の R6）。`gone_checked_at` は確かめる順を決める日時で、`consecutive_gone_count` は消すかを決める回数で、どちらも消えた印ではない。

## アプリケーションが守る決まり

| 決まり | 要件 | 置き場 |
|---|---|---|
| 取得のユースケースは life event の行を書かない | FR-032 | `src/features/activity/server/d1-activity-repository.ts` の取得の書き込みの文が `source <> 'life_event'` を条件にする |
| 公開日を返さない取得元から取り直すときは `published_at` を書かない | FR-012 | `src/features/activity/application/plan-refresh.ts`（計算の関数）。取得元の `FetchedItem.publishedAt` が無いときは列を直す対象にしない |
| 一覧を取り切れない取得元では、一覧に無いことで消さない | FR-018 | `src/features/activity/application/plan-removals.ts`。`isComplete` が偽なら消す候補を作らない |
| 1 回の取得で消す件数は上限まで。候補が上限を超えた回は 1 件も消さない | FR-019 | `src/features/activity/application/plan-removals.ts`。上限は引数 `limits`（research.md の R8） |
| 取得に失敗した取得元では activity を書き換えない。`last_succeeded_at` は前の値を残す | FR-014・FR-016 | `src/features/activity/application/refresh-sources.ts` |
| URL を指名する取得元の URL は、その取得元のホストに限る | FR-009、原則 2 | `src/features/activity/domain/sources.ts` |
| 日付の無い外部の activity は保存しない | FR-011 | 登録のユースケース。取得では、公開日を返す取得元で公開日が欠けた項目を取り込まず、`fetch_result.reason` に書く |
| 削除の操作は、URL を指名した・手で入力した activity と life event だけ | FR-022・FR-033 | 削除のユースケースが取得元の取り込み方を確かめる |
| 題が空（空白だけを含む）の life event を作らない・保存しない。前後の空白を除いて保存する | FR-024 | `src/features/activity/domain/life-event.ts` の `parseLifeEventContent`。入力の誤りを項目ごとに返すために置く。行は 0021 の CHECK `life_event_with_title` も拒む |
| 作るときの slug は推測できない値。オーナーは書き換えられる | FR-035 | life event の登録・編集のユースケース。形の検査は共有担当の slug の部品 |
| life event を消すときは画像の行と R2 のものを一緒に消す | FR-027 | life event の削除のユースケース。D1 の行は `media`・`activity` の順に 1 回の `batch()` で消し（`media.activity_id` の外部キーは送らずに確かめるため）、R2 のものは共有担当の部品で消す（research.md の R12） |
| 1 つの life event が持つ画像は 1 枚まで（代表画像だけ） | FR-028、constitution II | life event の画像の登録のユースケース。新しい画像を登録すると前の画像を消す（research.md の R12） |

## domain の型

`src/features/activity/domain/` に置く。

- `SourceName`: 取得元の名前（`activity_source.source`）
- `SourceKind`: `'article' | 'embed' | 'life_event' | 'other'`（0007 の CHECK と同じ値を `as const` で 1 か所に置く）
- `IntakeMode`: `'list' | 'url' | 'manual'`（取り込み方。ADR-0052 の 3 通り）。取得元の名前から引く表を `sources.ts` に置く。保管するデータに持たない（FR-004）
- `FetchedItem`: `{ url; title; publishedAt?; externalId?; imageUrl? }`。取得元ごとの処理が外部の応答から詰め替えた形（research.md の R3）
- `SourceListing`: `{ items: FetchedItem[]; isComplete: boolean }`
- `RefreshOutcome`: 取得元ごとの `{ source; ok: true; added; updated; removed; keptOverLimit; skippedWithoutDate } | { source; ok: false; reason }`。「失敗の表し方」の形で、投げない
- `ExternalActivity`（管理画面）: uid・取得元・URL・題・公開日・取り込み方
- `LifeEvent`（管理画面）: uid・slug・題・説明・起きた日・代表画像の id
- 表の行の型は `server/d1-activity-repository.ts` と `server/d1-life-event-repository.ts` の中だけで書く（001 の research.md の R3、research.md の R2）

## 訪問者向けの DTO

life event の個別のページ（[contracts/visitor-life-event.md](./contracts/visitor-life-event.md)）に渡す `VisitorLifeEvent`: slug・題・説明・起きた日。代表画像の URL（`cardImageUrl`、無ければ空）。`id`・`uid`・`created_at`・`updated_at` を含めない（constitution の Allowlist Visibility）。

外部の activity は個別のページを持たない（FR-034）。一覧（005）に渡す形は 005 が持つ。
