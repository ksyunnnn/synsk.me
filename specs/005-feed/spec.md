# Feature Specification: 一覧

**Feature Branch**: `feature/72-rebuild`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "一覧: 訪問者が見る一覧（activity_feed のビュー）。外部 activity・life event・note・実績・職歴を 1 つの並びで読む。並べる日付はそれぞれの元の日付（note は作成日、実績と職歴は始まりの日、life event は起きた日、外部 activity は公開日）。公開中の note だけを出し、秘匿化した実績・職歴は出してよい値だけで出す。転載先と一致する外部 activity は除く。"

## Contents

- Terms
- User Scenarios & Testing（User Story 1〜4、Edge Cases）
- Requirements（並べるもの・並びの日付と順・秘匿化・重なりの除外・種類とリンク）
- Key Entities
- Success Criteria
- Assumptions

## Terms

- **オーナー**、**訪問者**、**組織**、**職歴**、**実績**、**秘匿化**、**本文**: [001 の spec](../001-career-and-project/spec.md) の Terms と同じ意味で使う
- **note**、**公開**、**下書き**、**公開した版**、**削除**、**転載先**: [003 の spec](../003-note/spec.md) の Terms と同じ意味で使う
- **取得元**、**外部の activity**、**分類**、**life event**、**起きた日**: [004 の spec](../004-external-activity/spec.md) の Terms と同じ意味で使う
- **activity**: 一覧に並ぶ 1 件。外部の activity・life event・note・実績・職歴のどれか 1 つである
- **一覧**: activity を 1 つの並びにしたもの。訪問者が読む。一覧を見せる画面の名前は、UI を検討するときに決める
- **種類**: activity が外部の activity・life event・note・実績・職歴のどれかを表す値
- **並びの日付**: 一覧で activity を並べるのに使う日付。種類ごとに、元のデータが持つ日付を使う

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 外部と synsk.me の中の活動を、1 つの並びで見る (Priority: P1)

訪問者は一覧を開くと、外部の activity・life event・note・実績・職歴が、種類ごとの並びの日付の新しい順で 1 つの並びになって見える。activity はそれぞれ種類を持ち、種類ごとに合った見せ方で並ぶ。

**Why this priority**: 外部のサービスでの活動と synsk.me の中で作ったものを 1 か所にまとめて見せることが、一覧の目的である。

**Independent Test**: 作り物の外部の activity・life event・公開の note・実績・職歴を 1 件ずつ、並びの日付をずらして登録する。一覧を開き、5 件が並びの日付の新しい順に並ぶことと、それぞれの種類が分かることを確かめる。

**Acceptance Scenarios**:

1. **Given** 公開日が 2024-05-10 の外部の activity・起きた日が 2023-04-01 の life event・作成日が 2025-01-20 の公開の note・始まりの日が 2022-10-01 の実績・始まりの日が 2021-04-01 の職歴（すべて作り物）, **When** 訪問者が一覧を開く, **Then** note・外部の activity・life event・実績・職歴の順に並ぶ
2. **Given** 2020-01-15 に作り、2025-03-01 に初めて公開した note, **When** 訪問者が一覧を開く, **Then** その note は 2020-01-15 の位置に並ぶ
3. **Given** 始まりの日が 2022-10-01 で、終わりの日が 2024-03-31 の実績, **When** 訪問者が一覧を開く, **Then** その実績は 2022-10-01 の位置に並ぶ
4. **Given** 分類が埋め込みの取得元の外部の activity, **When** 訪問者が一覧を開く, **Then** その activity は、種類が外部の activity で、分類が埋め込みで、取得元が分かる形で並ぶ
5. **Given** 外部の activity が 1 件ある, **When** 訪問者がその activity を選ぶ, **Then** 取得元の URL が開く
6. **Given** 学歴が 1 件ある, **When** 訪問者が一覧を開く, **Then** 学歴は一覧の応答に含まれない

---

### User Story 2 - 秘匿化した職歴・実績を、出してよい値だけで並べる (Priority: P1)

秘匿化した職歴・実績も一覧に並ぶ。一覧の応答には、秘匿化した題・秘匿化した組織名・期間・種類・肩書・使ったスキルだけが含まれ、本文は伏せた見た目で出る。

**Why this priority**: 取引先などの実際の値が一度訪問者に出ると取り消せない（[SOFTWARE_DESIGN.md](../../docs/SOFTWARE_DESIGN.md) の設計原則 1）。

**Independent Test**: 秘匿化した実績と職歴を、本文・関連 URL・画像を入れて 1 件ずつ登録する。一覧の応答を調べ、実際の題・実際の組織名・本文の中身・関連 URL・画像が含まれないことを確かめる。

**Acceptance Scenarios**:

1. **Given** 秘匿化した実績（題「作り物の受託開発」、秘匿化した題「業務システムの開発」）, **When** 訪問者が一覧を開く, **Then** その実績は「業務システムの開発」と、組織の秘匿化した組織名で並ぶ
2. **Given** 本文・関連 URL・代表画像を持つ秘匿化した実績, **When** 一覧の応答を調べる, **Then** 実際の題・実際の組織名・本文の中身・関連 URL・画像が含まれない
3. **Given** 本文と関連 URL を持つ秘匿化した職歴, **When** 訪問者が一覧を開く, **Then** その職歴は組織の秘匿化した組織名・期間・肩書で並び、本文は伏せた見た目で出て、関連 URL は応答に含まれない
4. **Given** 秘匿化しない実績, **When** 訪問者が一覧を開く, **Then** その実績は実際の題と実際の組織名で並ぶ
5. **Given** 職歴と実績が指す組織の組織名をオーナーが直した, **When** 訪問者が一覧を開く, **Then** 秘匿化しない職歴と実績は直した組織名で並ぶ

---

### User Story 3 - 公開の note だけを並べる (Priority: P1)

一覧に並ぶ note は、公開で削除していないものだけである。並ぶ note の題と説明文は、公開した版のものである。

**Why this priority**: 下書きや削除した note が一覧から読めると、公開をやめる・削除する操作が成り立たない（[003 の spec](../003-note/spec.md) の User Story 2）。

**Independent Test**: 下書きの note・公開の note・公開してから削除した note・公開してから下書きに戻した note を 1 件ずつ作る。一覧の応答に公開の note だけが含まれることを確かめる。

**Acceptance Scenarios**:

1. **Given** 下書きの note, **When** 一覧の応答を調べる, **Then** その note は含まれない
2. **Given** 公開してから削除した note, **When** 一覧の応答を調べる, **Then** その note は含まれない
3. **Given** 公開してから下書きに戻した note, **When** 一覧の応答を調べる, **Then** その note は含まれない
4. **Given** 公開した後に題を直して保存し、公開し直していない note, **When** 訪問者が一覧を開く, **Then** その note は公開した版の題で並ぶ

---

### User Story 4 - 転載した note と、転載先から取り込んだ同じ記事を重ねない (Priority: P2)

オーナーが note を外部のサービスに転載し、その転載先の URL を記録すると、転載先から取り込んだ同じ記事は一覧に並ばない。一覧には note だけが並ぶ。

**Why this priority**: 転載した記事は、note と転載先の外部の activity の 2 件として一覧に重なって並びうる（[ADR-0006](../../docs/decisions/0006-posse-publishing-strategy.md) の「重複エントリの除外」）。重なっても一覧は読めるので、User Story 1〜3 より後に置く。

**Independent Test**: 公開の note に転載先の URL を記録し、同じ URL を持つ外部の activity を取り込む。一覧に note が並び、その外部の activity が並ばないことを確かめる。

**Acceptance Scenarios**:

1. **Given** 公開の note に転載先の URL を記録し、同じ URL の外部の activity を取り込んだ, **When** 訪問者が一覧を開く, **Then** note は並び、その外部の activity は並ばない
2. **Given** 転載先の URL と一致しない外部の activity, **When** 訪問者が一覧を開く, **Then** その外部の activity は並ぶ
3. **Given** 転載先の URL を記録した note を、下書きに戻すか削除した, **When** 訪問者が一覧を開く, **Then** 転載先の URL と一致する外部の activity は一覧に並ぶ

---

### Edge Cases

- 職歴・実績は下書きや非公開の状態を持たず、登録したものはすべて一覧に並ぶ。秘匿化したものは User Story 2 の値で並ぶ
- 終わりの日が空の職歴・実績も、始まりの日で並ぶ
- 同じ並びの日付の activity が複数あっても、同じデータを読むたびに同じ順で並ぶ
- 外部の activity と life event が同じ日のとき、起きた日は、その日の公開日時を持つ外部の activity より古いものとして並ぶ
- 取得に失敗した取得元の外部の activity は、保存した前回の値で並ぶ（[004 の spec](../004-external-activity/spec.md) の FR-014）
- 取得元で消えたと確かめた外部の activity は、何も示さずに並ばなくなる（004 の spec の FR-017）
- 一覧に並ぶ activity が 0 件でも、一覧は成り立つ（[REQUIREMENTS.md](../../docs/REQUIREMENTS.md) の NFR-02）

## Requirements *(mandatory)*

### Functional Requirements

**並べるもの**

- **FR-001**: 一覧には、外部の activity・life event・note・実績・職歴を並べる。学歴は一覧に並べず、一覧の応答に含めない
- **FR-002**: 外部の activity は、[004 の spec](../004-external-activity/spec.md) の FR-014・FR-017〜FR-020 が一覧に残すとするものを並べる。どの外部の activity が取得元で消えたかは、004 の spec の決定に従う
- **FR-003**: life event は、保存したものをすべて並べる（004 の spec の FR-026）
- **FR-004**: 実績と職歴は、秘匿化するかどうかに関わらず、登録したものをすべて並べる
- **FR-005**: note は、公開で、削除していないものだけを並べる。下書きの note と削除した note は、一覧の応答に含めない
- **FR-006**: 一覧に並ぶ note の題と説明文は、公開した版のものである。公開した後に保存した版の内容は、一覧の応答に含めない（[003 の spec](../003-note/spec.md) の FR-012）

**並びの日付と順**

- **FR-007**: 並びの日付は、種類ごとに次のとおりである。外部の activity は公開日（オーナーが登録した日付を含む。004 の spec の FR-011）、life event は起きた日、note は作成日、実績と職歴は始まりの日
- **FR-008**: note を公開する・公開し直す・下書きから公開に戻す操作は、その note の並びの日付を変えない
- **FR-009**: 職歴と実績の終わりの日は、並びに使わない
- **FR-010**: 一覧は、並びの日付の新しい順に並べる。並びの日付が同じ activity は、種類と、種類ごとの activity の番号で順を決め、同じデータを読むたびに同じ順で並べる
- **FR-011**: 外部の activity の公開日と life event の起きた日が同じ日のとき、起きた日は、その日の公開日時より古いものとして並べる

**秘匿化**

- **FR-012**: 秘匿化した実績・職歴について、一覧の応答に含めてよい値は、秘匿化した題（実績）・組織の秘匿化した組織名・期間・種類（実績）・肩書（職歴）・使ったスキルだけである（[001 の spec](../001-career-and-project/spec.md) の FR-026）
- **FR-013**: 秘匿化した実績・職歴の実際の題・実際の組織名・本文の中身・関連 URL・画像（本文の画像と代表画像）を、一覧の応答に含めない。本文は伏せた見た目で出す（001 の spec の FR-021・FR-022・FR-030）
- **FR-014**: 秘匿化しない実績・職歴は、実際の値で並べる（001 の spec の FR-023）
- **FR-015**: 公開の note だけを並べる決まり（FR-005）と、秘匿化の決まり（FR-012・FR-013）は、一覧のデータを取り出すところで守る。画面へは、出してよい値だけを渡す。画面の側で値を外すことに頼らない（[ADR-0029](../../docs/decisions/0029-visibility-check-at-retrieval.md)、[ADR-0028](../../docs/decisions/0028-dto-for-screens.md)）

**重なりの除外**

- **FR-016**: note の転載先として記録した URL と一致する URL を持つ外部の activity は、一覧に並べない（[ADR-0006](../../docs/decisions/0006-posse-publishing-strategy.md)）。転載元の note が下書きか削除で一覧に並ばないときは除かない。除くのは重なりを避けるためで、note が並ばなければ重なりは無い
- **FR-017**: 転載先の URL と一致しない外部の activity は、FR-016 で除かない

**種類とリンク**

- **FR-018**: 一覧の activity は、それぞれ種類を持つ。画面は種類ごとに見せ方を分けられる
- **FR-019**: 外部の activity と life event は、取得元とその分類を持つ。分類は取得元ごとに決まる（004 の spec の FR-001・FR-002）。分類が埋め込みの activity は、どの埋め込みで見せるかを取得元で決める
- **FR-020**: 外部の activity は、取得元の URL へ直接リンクする。外部の activity は synsk.me の上に個別の URL を持たない（[ADR-0016](../../docs/decisions/0016-url-conventions.md)）
- **FR-021**: 秘匿化しない職歴・実績の組織名は、組織の組織名を直すと、一覧でも直した組織名になる（001 の spec の FR-004）

### Key Entities *(include if feature involves data)*

- **activity（一覧の 1 件）**: 種類・並びの日付・種類ごとの番号と、種類ごとに出してよい値を持つ。元のデータ（外部の activity と life event、note、実績、職歴）を指し、一覧のために値を写して持たない
- **転載先**: note が持つ転載先の URL（003 の spec の Key Entities）。一覧から除く外部の activity を決めるのに使う

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 秘匿化した職歴・実績のすべてについて、一覧の応答に、実際の題・実際の組織名・本文の中身・関連 URL・画像が 0 件含まれる
- **SC-002**: 下書きの note・削除した note・公開した後に保存して公開し直していない版の内容が、一覧の応答に 0 件含まれる
- **SC-003**: 公開の note の転載先の URL と一致する外部の activity が、一覧に 0 件並ぶ
- **SC-004**: 5 つの種類を混ぜ、並びの日付が同じ組を含む検査用のデータで、一覧の順が手で並べた順と一致し、2 回続けて読んだ順が同じである
- **SC-005**: 学歴が、一覧の応答に 0 件含まれる

## Assumptions

**ほかの spec・文書との関係**

- 職歴・実績・組織・スキルの登録と、秘匿化で出してよい値の決まりは [001 の spec](../001-career-and-project/spec.md) が持つ。伏せた見た目の本文の具体的な形は、001 の spec の決定に従う
- note の公開・下書き・削除と転載先の記録は [003 の spec](../003-note/spec.md) が持つ
- 外部の activity の取得、取得元で消えた activity の扱い、life event の作成と編集は [004 の spec](../004-external-activity/spec.md) が持つ。取得元で消えたと判定する条件は、004 の spec の決定に従う
- 一覧は元のデータを読み、一覧のために値を写して持たない（[ADR-0044](../../docs/decisions/0044-content-data-model-by-organization.md)）
- データがない・読み込み中・一部欠損・エラーの各状態で画面が成立すること（NFR-02）、表示の速さ（NFR-03〜NFR-07）、公開していない内容を範囲の外の人への応答に含めないこと（NFR-08）、キャッシュに残さないこと（NFR-09）は [REQUIREMENTS.md](../../docs/REQUIREMENTS.md) が持つ

**決まっていて、実装のときに詰めるもの**

- ページ送りの仕方
- 一覧を実装するときに、一覧の読み取り行数を測る。遅ければ、値を写して持つ形に移す（ADR-0044 の Confirmation）
- 一覧の activity に並べる値（FR-012 は秘匿化したものに含めてよい値の上限であり、並べる値は UI を考えるときに決める）
- 実績の期間の見せ方と、職歴の終わりの日を行の中に期間として出すか

**決定が無く、この spec では決めない**

- 並びの日付が同じとき、どの種類を先に並べるか
- 種類をまたいで、暦の日付（life event・実績・職歴）と日時（外部の activity の公開日・note の作成日）が同じ日のときの順と、日の境目をどの時刻帯で決めるか
- 一覧から note と実績の個別のページへリンクするか
- 一覧に note・実績・life event の代表画像を出すか。外部の activity の代表の画像の出し方（材料: #186）
- 転載先の URL と外部の activity の URL が一致するとみなす条件（末尾のスラッシュ・問い合わせの部分の違いなど）
- 絞り込みと検索
- 一覧を見せる画面の名前と URL
- 公開の操作や元のデータを直したあと、一覧に見えるまでの時機とキャッシュの扱い
