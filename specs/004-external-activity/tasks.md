---

description: "外部 activity の取得の実装タスク"
---

# Tasks: 外部 activity の取得

**Input**: `specs/004-external-activity/` の plan.md・spec.md・research.md・data-model.md・contracts/・quickstart.md

**Prerequisites**: plan.md、spec.md

**Tests**: 検査のタスクを含める。constitution の III（要件の 1 つ 1 つに検査を対応させる）と I（書き込みの経路に、オーナー以外が通れないことの検査を書く）が求める。対応は plan.md の「要件と検査の対応」が持つ

**Organization**: User Story ごとに段階を分ける。各段階は単独で確かめられる

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並べて進められる（別のファイルで、終わっていないタスクに依存しない）
- **[Story]**: spec.md の User Story（US1〜US5）
- **止める未決: U<n>**: plan.md の「未決」の U<n> が解けるまで着手しない
- **止める依存: 共有担当の media-storage**: `src/shared/server/media-storage.ts`（001 の T075）が epic に入るまで着手しない
- **止める依存: 共有担当の migration**: `activity.uid` と取得元の行を足す migration（data-model.md の「要る migration の変更」）が epic に入るまで着手しない
- **issue**: 取得元ごとの issue と対応するタスクに `（#<番号>「<題>」）` を添える

## Contents

- Phase 1: Setup
- Phase 2: Foundational
- Phase 3: User Story 1（P1）一覧を自動で取り込む
- Phase 4: User Story 2（P1）取得に失敗しても一覧を出し続ける
- Phase 5: User Story 3（P1）取得元で消したものを一覧から消す
- Phase 6: User Story 4（P2）URL を指名して、または手で入力して取り込む
- Phase 7: User Story 5（P2）life event
- Phase 8: Polish
- Dependencies & Execution Order
- 取得元ごとの issue との対応
- Implementation Strategy

---

## Phase 1: Setup

**Purpose**: スキーマと道具の前提を確かめる

- [x] T001 共有担当の migration（`activity.uid`・取得元の行）が `epic/219-complete-specs` に入っていることを確かめ、入った migration の取得元の `source` の値を src/features/activity/domain/sources.ts（T011）に写す。入るまで、この印の付いたタスクを止める（research.md の R1）。取得元を種類ごとに分けること（FR-003）と、手で付ける値の列が無いこと（FR-021）はスキーマが持つ（data-model.md）。**止める依存: 共有担当の migration**
- [x] T002 [P] 取得元の認証情報（`GITHUB_TOKEN`・`QIITA_ACCESS_TOKEN`・`CONNPASS_API_KEY`）の型を src/shared/server/env.ts に足し、値の雛形を .dev.vars.example に足す（research.md の R15）
- [x] T003 [P] workerd で RSS の XML を読む手段（`DOMParser` の有無、無ければ使う package）を確かめ、結果と確かめた日付を specs/004-external-activity/research.md の R3 に書く。package を足すときは使い手（Zenn・Medium・Speaker Deck）を R3 に書く（constitution IX）

---

## Phase 2: Foundational

**Purpose**: どの User Story も使う型・取得元の表・Repository・組み立て・proxy

- [x] T010 [P] 分類（`SourceKind`）・取り込み方（`IntakeMode`）・`FetchedItem`・`SourceListing`・`RefreshOutcome` の型を src/features/activity/domain/fetched-item.ts に作る（data-model.md の「domain の型」）
- [x] T011 取得元の表（取得元の名前・取り込み方・URL を指名する取得元が受け付けるホスト）を src/features/activity/domain/sources.ts に `as const` で作る。分類は D1 の `activity_source.kind` を正とし、ここに写さない（FR-001〜FR-005、research.md の R3・R10）。取得元の名前は T001 が migration から写す。**止める依存: 共有担当の migration**
- [ ] T012 [P] 外部の activity と life event の型を src/features/activity/domain/external-activity.ts と src/features/activity/domain/life-event.ts に作る。管理画面の型は uid を持ち、id を画面に出さない
- [ ] T013 Repository のインタフェース（外部の activity の取り出し・取得の書き込み・登録・削除、life event の取り出し・登録・編集・削除・slug の有無、`findIdByUid`）を src/features/activity/domain/activity-repository.ts に作る。手本は src/features/project/domain/project-repository.ts
- [x] T014 [P] 単体の検査で渡す作り物の Repository と、作り物の応答を返す `fetcher` を tests/support/activity-fakes.ts に作る
- [ ] T015 D1 の実装を src/features/activity/server/d1-activity-repository.ts に作る。行の型はこのファイルの中だけで書く。取得の書き込みの文は `source <> 'life_event'` を条件にする（FR-032、research.md の R13）
- [x] T016 [P] 作り物の activity の行を D1 に入れる道具を tests/support/activity-rows.ts に作る
- [ ] T017 ユースケースが受け取るもの（`ActivityDeps`）を src/features/activity/application/deps.ts に、組み立て用の関数を src/features/activity/server/queries.ts に作る。手本は src/features/project/application/deps.ts と src/features/project/server/queries.ts
- [ ] T018 本番の上限の値を src/features/activity/domain/limits.ts に置く（research.md の R8）。**止める未決: U13**
- [ ] T019 src/app/dash/page.tsx の入口に「life event」と「外部の activity」を足す

---

## Phase 3: User Story 1 - 外部のサービスに書いたものを、一覧に自動で取り込む (Priority: P1) 🎯 MVP

**Goal**: 一覧を取る取得元の項目が、題・URL・公開日を持つ activity として保存され、取り直しても増えない

**Independent Test**: 作り物の Zenn の応答で `refreshSources` を 2 回走らせ、記事が 1 行ずつ保存されることを workerd で確かめる

### Tests for User Story 1

- [x] T020 [P] [US1] `planRefresh` が、新しい項目を足す行に、値の変わった項目を直す行に、変わらない項目を書かない行にすることと、ID を返す取得元は ID で・返さない取得元は URL で同じ項目を判定することを tests/unit/activity-plan-refresh.test.ts で確かめる（FR-005・FR-008・SC-001）
- [x] T021 [P] [US1] 取り直しても行が増えず、`created_at` が変わらず、取り込んだ行の取得元が `activity_source` の取得元であることを tests/workers/activity-repository.test.ts で確かめる（FR-002・FR-008・FR-013、US1 の Acceptance 4）。**止める依存: 共有担当の migration**

### Implementation for User Story 1

- [x] T022 [US1] 足す・直す・消す行を求める計算だけの関数 `planRefresh` を src/features/activity/application/plan-refresh.ts に作る。外への要求も D1 も触らない（research.md の R4・R5）
- [x] T023 [US1] 取得のユースケース `refreshSources` を src/features/activity/application/refresh-sources.ts に作る。取得元ごとに読む → `planRefresh` → 1 回の `batch()` で書く。`batch()` が失敗したら、その取得元の `fetch_result` に失敗と理由を別に書く（FR-016、research.md の R4）。上限は引数 `limits` で受け取る（contracts/fetch.md）
- [x] T024 [US1] 取得元の書き込み（足す・直す・`fetch_result` の上書き）を 1 回の `batch()` で行う関数を src/features/activity/server/d1-activity-repository.ts に足す
- [x] T025 [US1] `fetcher` に User-Agent・待ち時間・応答の大きさの上限をかける関数を src/features/activity/server/sources/fetch-with-limits.ts に作る（research.md の R8、contracts/fetch.md）。待ち時間と大きさを超えたら失敗になることを tests/unit/activity-fetch-with-limits.test.ts で確かめる

### 取得元ごとの処理（各取得元は T022〜T025 の後に並べられる）

各タスクは、取得元の処理を src/features/activity/server/sources/<取得元>.ts に作り、作り物の応答（検証記録の実データの形）から `FetchedItem` に詰め替えることと `isComplete` の値を tests/unit/activity-source-<取得元>.test.ts で確かめる（FR-006・FR-007、constitution VII）。頁を辿る取得元（T031・T032・T035・T036）では、要求の数の上限で辿るのを止めたときに `isComplete` が偽になることも確かめる（research.md の R7、FR-018・FR-020）。

- [x] T030 [P] [US1] Zenn（RSS、guid が URL、20 件固定で `isComplete` は偽）。src/features/activity/server/sources/zenn.ts（#168「外部の取得の仕組みを作り、Zenn を取り込む」）
- [x] T031 [P] [US1] Qiita（REST、ID、`total-count` まで頁を辿る。`QIITA_ACCESS_TOKEN` が欠ければ未認証で取る）。src/features/activity/server/sources/qiita.ts（#169「Qiita を取り込む」）
- [x] T032 [P] [US1] dev.to（REST、ID、User-Agent を必ず付ける）。src/features/activity/server/sources/devto.ts（#170「dev.to を取り込む」）
- [x] T033 [P] [US1] Medium（RSS、guid が ID、`link` の問い合わせの部分を除く、10 件固定で `isComplete` は偽、画像は `content:encoded` の先頭の `<img>`）。src/features/activity/server/sources/medium.ts（#171「Medium を取り込む」）
- [x] T034 [P] [US1] Speaker Deck（RSS、guid が URL、`isComplete` は偽）。src/features/activity/server/sources/speakerdeck.ts（#172「Speaker Deck を取り込む」）
- [ ] T035 [P] [US1] GitHub（REST、ID、`pushed_at` が null なら `created_at`、`GITHUB_TOKEN` が欠ければ未認証）。src/features/activity/server/sources/github.ts（#173「GitHub を取り込む」）
- [x] T036 [P] [US1] connpass（REST v2、ID、`CONNPASS_API_KEY` が欠ければ要求を出さず失敗、要求は 5 秒に 1 回まで）。src/features/activity/server/sources/connpass.ts（#174「connpass を取り込む」）

### 取得の入口

- [ ] T040 [US1] `worker/index.ts` に `scheduled` を足して `refreshSources` を呼び、`wrangler.jsonc` に `triggers` を書く。間隔は research.md の R8 の値を使う（R9）。`triggers` があることと、`scheduled` が `refreshSources` を呼ぶことを tests/unit/activity-scheduled.test.ts で確かめる（FR-036）。**止める未決: U13**
- [ ] T041 [US1] 条件付きの要求（research.md の R9）: 取得元が返した `ETag`・`Last-Modified` を、activity を書く `batch()` の中で `fetch_result` に書き、次の実行で `If-None-Match`・`If-Modified-Since` を付け、304 なら activity を書かず `fetch_result` を成功として書くことを tests/unit/activity-refresh-sources.test.ts と tests/workers/activity-repository.test.ts で確かめる。2 頁目以降を取った・失敗した・上限で消さずに残した・公開日の欠けた項目を取り込まなかったときは値を NULL にする。**止める依存: 共有担当の migration**（`fetch_result` の列）

---

## Phase 4: User Story 2 - 取得に失敗しても、一覧を出し続ける (Priority: P1)

**Goal**: 1 つの取得元の失敗で、その取得元の activity を消さず、ほかの取得元を止めず、取得の結果を記録する

**Independent Test**: 作り物の取得元 A を失敗させ B を成功させて `refreshSources` を走らせ、A の行が残り、B が取り込まれ、A の `fetch_result` に失敗と理由が書かれることを確かめる

- [ ] T042 [P] [US2] 取得元 A が投げる・形の違う応答を返す・上限を超えるとき、A の activity を書き換えず、B の取り込みが止まらず、`RefreshOutcome` に A の失敗と理由が入ることと、A の書き込みの `batch()` が失敗したときも A の `fetch_result` に失敗が書かれることを tests/unit/activity-refresh-sources.test.ts で確かめる（FR-014・FR-015・FR-020・SC-002）
- [ ] T043 [P] [US2] 失敗した取得元の `fetch_result` に取り直した日時・失敗・理由が書かれ、2 回続けて失敗しても `last_succeeded_at` が前の値のまま残り、取得元 B の `batch()` は A の失敗で戻らないことを tests/workers/activity-repository.test.ts で確かめる（FR-016、US2 の Acceptance 3・4）。**止める依存: 共有担当の migration**
- [ ] T044 [US2] T042・T043 が通るように src/features/activity/application/refresh-sources.ts と src/features/activity/server/d1-activity-repository.ts の失敗の扱いを直す。`Promise.allSettled` で並べ、投げない（docs/SOFTWARE_DESIGN.md の「失敗の表し方」）

---

## Phase 5: User Story 3 - 取得元で消したものを、一覧から消す (Priority: P1)

**Goal**: 取得元で消えたと確かめた activity の行を消し、確かめられないあいだと上限を超えた分は残す

**Independent Test**: `isComplete` が真の作り物の取得元から 1 件を外して取り直し、その行が消えることを確かめる。`isComplete` が偽の取得元では消えないことを確かめる

- [ ] T045 [P] [US3] `planRefresh` が、`isComplete` が真のときだけ一覧に無い activity を消す候補にし、偽のときは候補にせず、候補が上限を超えたら超えた分を残して理由を返すことを tests/unit/activity-plan-refresh.test.ts で確かめる（FR-017〜FR-020・SC-003・SC-004）
- [ ] T046 [P] [US3] 消す行が `batch()` で消え、life event の行と、ほかの取得元の行を消さないことを tests/workers/activity-repository.test.ts で確かめる（FR-017・FR-032）。**止める依存: 共有担当の migration**
- [ ] T047 [US3] 消す候補と上限を src/features/activity/application/plan-refresh.ts に、消す文を src/features/activity/server/d1-activity-repository.ts に足す（research.md の R6）
- [ ] T048 [US3] `isComplete` が偽の取得元（Zenn・Medium・Speaker Deck）で、個別の URL を取り直して消えたと確かめる条件（404 の扱いを含む）を取得元ごとに決め、条件と実測の日付を specs/004-external-activity/research.md の R6 に書いてから、src/features/activity/server/sources/ の該当ファイルに足す。条件を決められない取得元は自動では消さない（FR-020）

---

## Phase 6: User Story 4 - URL を指名して、または手で入力して取り込む (Priority: P2)

**Goal**: URL を指名する取得元・手で入力する取得元・登録していないサイトの activity を、オーナーが登録・編集・削除できる

**Independent Test**: URL を指名する取得元に URL と日付を登録し、題が取られて保存され、取り直しても日付が変わらないことを確かめる

### Tests for User Story 4

- [ ] T049 [P] [US4] 登録のユースケースが、日付の無い登録を拒み、取得元のホストでない URL を拒み、一覧を取る取得元への登録を拒み、題を取って保存し、手で入力する取得元では送られた値で保存し、削除のユースケースが一覧を取る取得元の activity を拒むことを tests/unit/activity-register.test.ts で確かめる（FR-009〜FR-011・FR-022・FR-033、US4 の Acceptance 1・3・5）

### Implementation for User Story 4

- [ ] T050 [US4] URL を指名する登録のユースケースを src/features/activity/application/register-external-activity.ts に作る。日付の持ち方は U12 の答えに従う。題を取れないときの扱いは U11 の答えに従う（FR-009・FR-011）。**止める未決: U11・U12**
- [ ] T051 [P] [US4] URL を指名する取得元の処理を作り、作り物の応答から `FetchedItem` に詰め替えることと、取れないとき null を返すことを確かめる。Spotify は src/features/activity/server/sources/spotify.ts と tests/unit/activity-source-spotify.test.ts（#175「Spotify を取り込む」）、X は src/features/activity/server/sources/x.ts と tests/unit/activity-source-x.test.ts（#176「X を取り込む」）、CodeSandbox は src/features/activity/server/sources/codesandbox.ts と tests/unit/activity-source-codesandbox.test.ts（`og:title` が既定値なら null。#177「CodePen と CodeSandbox を手で登録できるようにする」。spec に従い URL を指名する形で作る）、YouTube は src/features/activity/server/sources/youtube.ts と tests/unit/activity-source-youtube.test.ts（取得元ごとの issue は無い）
- [ ] T052 [US4] 手で入力する登録（CodePen）を src/features/activity/application/register-external-activity.ts に足す（FR-010。#177「CodePen と CodeSandbox を手で登録できるようにする」）。**止める未決: U12**
- [ ] T053 [US4] 登録していないサイトの登録を src/features/activity/application/register-external-activity.ts に足す。同じ URL を 2 行にしない（FR-005、US4 の Acceptance 4。取得元ごとの issue は無い）。**止める未決: U11・U12**
- [ ] T054 [US4] 編集のユースケース（日付、手で入力した activity は URL と題も）を src/features/activity/application/edit-external-activity.ts に、削除のユースケースを src/features/activity/application/delete-external-activity.ts に作る（FR-031・FR-033）
- [ ] T055 [P] [US4] URL を指名した activity の保存が日付をオーナーの入力の値だけで書き、`planRefresh` の書き込みが公開日の無い項目の `published_at` を変えないことと、登録・編集・削除の保存を tests/workers/activity-repository.test.ts で確かめる（FR-012・SC-005、research.md の R5）。**止める依存: 共有担当の migration**
- [ ] T056 [US4] Server Action `registerExternalActivity`・`editExternalActivity`・`deleteExternalActivity` を src/features/activity/server/actions.ts に、入力を src/features/activity/components/external-activity-form.tsx に作る。入力は共有担当の src/shared/components/draft-retention.tsx で保持する（contracts/dash.md）
- [ ] T057 [US4] 管理画面のページを src/app/dash/activities/page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作り、src/proxy.ts に `/dash/activities/{uid}` の有無を足す。**止める依存: 共有担当の migration**
- [ ] T058 [US4] JWT のない `registerExternalActivity`・`editExternalActivity`・`deleteExternalActivity` が何も書かないことを tests/integration/activity-dash.test.ts で確かめる（FR-031、constitution I）
- [ ] T059 [US4] オーナーとして外部の activity を登録・編集・削除し、キーボードだけで同じ操作ができることを tests/e2e/external-activity.spec.ts で確かめる（constitution V）。登録は作り物の応答を返すように取得元の要求を差し替える

---

## Phase 7: User Story 5 - life event を書き、一覧に並べ、個別のページで見せる (Priority: P2)

**Goal**: オーナーが life event を作り・書き換え・消し、訪問者が `/life-events/{slug}` で見る

**Independent Test**: life event を 1 件作り、訪問者としてその slug の URL で個別のページを開く。削除して行が残らないことを確かめる

### Tests for User Story 5

- [x] T060 [P] [US5] 登録・編集のユースケースが、起きた日の無い保存を拒み、識別子が空なら推測できない値を入れ、形の違う識別子を拒むことを tests/unit/activity-life-event.test.ts で確かめる（FR-023〜FR-025・FR-035、US5 の Acceptance 1〜3・8）
- [x] T061 [P] [US5] life event の保存・識別子の重複の拒否・削除で行が残らないことを tests/workers/activity-life-event.test.ts で確かめる（FR-027 の画像の無い部分・FR-035、US5 の Acceptance 10）。**止める依存: 共有担当の migration**
- [x] T062 [P] [US5] `/life-events/{slug}` が 200 で DTO の値だけを返し、無い slug と書き換える前の slug で 404 になることを tests/integration/life-events.test.ts で確かめる（FR-026・FR-034・SC-007）
- [x] T063 [P] [US5] `src/proxy.ts` が `/life-events/{slug}` の有無で rewrite することを tests/unit/proxy.test.ts に足す

### Implementation for User Story 5

- [x] T064 [US5] 登録・編集・削除・訪問者向けの取り出しのユースケースを src/features/activity/application/register-life-event.ts・edit-life-event.ts・delete-life-event.ts・get-visitor-life-event.ts に作る。識別子の形と既定値は共有担当の src/shared/domain/slug.ts の `isSlug`・`newSlug` を使う（research.md の R11）
- [x] T065 [US5] 訪問者向けの DTO `VisitorLifeEvent` と、出してよい列だけを読む取り出しを src/features/activity/domain/life-event.ts と src/features/activity/server/d1-life-event-repository.ts に足す（contracts/visitor-life-event.md、constitution の Allowlist Visibility）
- [x] T066 [US5] Server Action `registerLifeEvent`・`editLifeEvent`・`deleteLifeEvent` を src/features/activity/server/actions.ts に、入力を src/features/activity/components/life-event-form.tsx に作る。リンク先の入力を持たない（FR-024）。入力は共有担当の src/shared/components/draft-retention.tsx で保持する
- [x] T067 [US5] 管理画面のページを src/app/dash/life-events/page.tsx・new/page.tsx・[id]/page.tsx・[id]/delete/page.tsx・[id]/missing/page.tsx に作り、src/proxy.ts に `/dash/life-events/{uid}` の有無を足す。**止める依存: 共有担当の migration**
- [x] T068 [US5] 訪問者のページを src/app/life-events/[slug]/page.tsx・src/app/life-events/[slug]/missing/page.tsx と src/features/activity/components/visitor-life-event.tsx に作り、src/proxy.ts の matcher に `/life-events/:slug` を足す
- [x] T069 [US5] JWT のない life event の Server Action が何も書かないことを tests/integration/activity-dash.test.ts に足し、オーナーとして life event を作成・編集・削除し、キーボードだけで同じ操作ができることを tests/e2e/life-event.spec.ts で確かめる（FR-031、constitution I・V）

### 画像（共有担当の src/shared/server/media-storage.ts が入ってから）

- [ ] T070 [US5] 共有担当の src/shared/server/media-storage.ts を使い、life event の代表画像の登録と、その life event の画像だけを選べることを作り、tests/workers/activity-life-event.test.ts で確かめる。1 つの life event の画像は 1 枚までで、新しく登録すると前の画像を消す。形式（JPEG・PNG・WebP・GIF）と 10 MB の上限は共有担当の部品で確かめる（FR-028・FR-029、US5 の Acceptance 4・5、research.md の R12）。**止める依存: 共有担当の media-storage**
- [ ] T071 [US5] life event の代表画像を配る経路を src/app/life-events/[slug]/media/[id]/route.ts に作り、DTO に `cardImageUrl` を足す。その life event の代表画像だけが 200 で、ほかの持ち主の画像が 404 になることを tests/integration/life-events.test.ts で確かめる（FR-029・FR-030、contracts/visitor-life-event.md）。**止める依存: 共有担当の media-storage**
- [ ] T072 [US5] life event を消すときに、その life event の `media` の行と R2 のものを一緒に消し、残らないことを tests/workers/activity-life-event.test.ts で確かめる（FR-027・SC-006、US5 の Acceptance 6、research.md の R12）。**止める依存: 共有担当の media-storage**

---

## Phase 8: Polish

- [ ] T080 `npm run build`・`npx tsc --noEmit`・`npm run lint`・`npm run format:check`・`npm test`・`npm run test:workers`・`npm run test:integration`・`npm run test:e2e` が通ることを確かめる
- [ ] T081 PR の CI が 10 分以内に収まることを GitHub Actions のステップの所要時間で確かめる（ADR-0019）
- [ ] T082 quickstart.md の手順をブランチの Preview で行う
- [ ] T083 src/features/activity/application/refresh-sources.ts が「失敗の表し方」の最初の手本になることを PM に伝える。docs/SOFTWARE_DESIGN.md の「手本のファイル」は 001 の T079 がまとめて書く

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → Phase 3 以降。ただし「止める未決」「止める依存」の印の付いたタスクは、印の付かないタスクを止めない
- 「止める依存: 共有担当の migration」の付いたタスクは T001 の後
- 取得元の名前を使うタスク（T030〜T036・T051）は T011 の後
- Phase 3（US1）は MVP。Phase 4（US2）と Phase 5（US3）は Phase 3 の T022〜T024 の後
- Phase 6（US4）は Phase 2 と T025 の後。Phase 7（US5）は Phase 2 の後に、Phase 3〜6 と並べられる
- Phase 8 は各 User Story の後

### User Story Dependencies

- US1: Phase 2 だけに依存
- US2: US1 の T023・T024 に依存
- US3: US1 の T022・T024 に依存
- US4: Phase 2 と US1 の T025 に依存
- US5: Phase 2 だけに依存

### 未決と依存が止めるタスク

| 未決・依存 | 止めるタスク |
|---|---|
| U11 | T050 の題を取れないときの分岐、T053 |
| U12 | T050・T052・T053 |
| U13 | T018・T040 |
| 共有担当の migration | T001・T011・T021・T041・T043・T046・T055・T057・T061・T067 |
| 共有担当の slug の部品（PR #222） | T064 |
| 共有担当の書きかけの保持（001 の T072） | T056・T066 |
| 共有担当の media-storage（001 の T075） | T070・T071・T072 |

### Within Each User Story

- 検査を先に書き、落ちることを確かめてから実装する
- domain → application → server → components → app の順

### Parallel Opportunities

- Phase 1: T002・T003 は別のファイル
- Phase 2: T010・T012・T014・T016 は別のファイル
- US1 の取得元ごとの処理 T030〜T036 は、T022〜T025 の後にすべて並べられる
- US5 は Phase 2 の後、US1〜US4 と並べられる

## 取得元ごとの issue との対応

| issue | タスク |
|---|---|
| #168「外部の取得の仕組みを作り、Zenn を取り込む」 | T010〜T025（仕組み）、T030（Zenn）、T040・T041（入口） |
| #169「Qiita を取り込む」 | T031 |
| #170「dev.to を取り込む」 | T032 |
| #171「Medium を取り込む」 | T033 |
| #172「Speaker Deck を取り込む」 | T034 |
| #173「GitHub を取り込む」 | T035 |
| #174「connpass を取り込む」 | T036 |
| #175「Spotify を取り込む」 | T050・T051（Spotify） |
| #176「X を取り込む」 | T050・T051（X） |
| #177「CodePen と CodeSandbox を手で登録できるようにする」 | T051（CodeSandbox、URL を指名する）・T052（CodePen） |
| issue 無し | T051（YouTube）、T053（登録していないサイト）、Phase 7（life event） |

## Parallel Example: User Story 1

```text
T020 tests/unit/activity-plan-refresh.test.ts
T021 tests/workers/activity-repository.test.ts
↓
T022 src/features/activity/application/plan-refresh.ts
T023 src/features/activity/application/refresh-sources.ts
T024 src/features/activity/server/d1-activity-repository.ts
T025 src/features/activity/server/sources/fetch-with-limits.ts
↓
T030・T031・T032・T033・T034・T035・T036 は並べる
```

## Implementation Strategy

### MVP First

1. Phase 1・Phase 2
2. Phase 3（US1）の T020〜T025 と T030（Zenn）で、作り物の応答から Zenn の記事を保存する
3. Phase 4（US2）と Phase 5（US3）を足す。失敗の扱いと消し方が無いまま取得の入口（T040）を開くと、FR-014・FR-017 を満たさない状態で本番の activity を書き換えるため、入口は US2・US3 の後に作る

### Incremental Delivery

US1+US2+US3 → 入口（U13 が解けてから）→ US4 → US5 → US5 の画像（共有担当の media-storage が入ってから）→ Polish。各段階を Preview で確かめてから epic に入れる

## Notes

- 機能どうしは import しない（ADR-0026）。一覧（005）は `activity` を自分の機能の中で読む
- 書き込みの Server Action は、先頭でオーナーを確かめる。呼び忘れは型でも lint でも検出しないため、結合の検査で各 Server Action を確かめる（ADR-0036 の Consequences）
- 004 は migration と ER 図を変えない。要る変更は PM に伝える
- コミットはタスクか論理のまとまりごと
