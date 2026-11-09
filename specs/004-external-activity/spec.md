# Feature Specification: 外部 activity の取得

**Feature Branch**: `feature/72-rebuild`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "外部 activity の取得: 外部のサービス（取得元）から activity を取得して保存し、取得に失敗したときは前回の値で一覧に出す。取得元で消えた activity は何も示さずに一覧から消す。外部の activity にオーナーが手で付ける値は持たない。オーナーは life event（synsk.me の中で作る人生の出来事）を管理画面で作成・編集し、代表画像を持たせる。"

## Contents

- Clarifications
- Terms
- User Scenarios & Testing（User Story 1〜5、Edge Cases）
- Requirements（取得元と分類・取得と保存・取得の失敗・取得元で消えた activity・手で付ける値・life event・画像・書き換え）
- Key Entities
- Success Criteria
- Assumptions

## Clarifications

### Session 2026-11-09

- Q: 一覧を取る取得元からの取得は、いつ走るか？ → A: システムが定期的に自動で走らせる。オーナーが画面から取り直す操作は持たない（2026-11-09、オーナー。[issue #219 のコメント](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6732950051)）
- Q: 1 回の取得で消す候補が上限を超えたら、上限までは消すか？ → A: 1 件も消さない。一度に多く消えるのは取得元の誤り（空の一覧が返るなど）の兆しで、消したものは取り消せない。その回の取得の結果の理由に止めた旨を書き、次の回も同じなら同じく止める（2026-11-09、PM。SOFTWARE_DESIGN.md の設計原則 2 から導いた）

## Terms

- **オーナー**、**訪問者**: [001 の spec](../001-career-and-project/spec.md) の Terms と同じ意味で使う
- **activity**: 一覧に並ぶ 1 件。この spec が扱うのは外部の activity と life event である
- **取得元**: 外部の activity の出どころ。1 つのサービスから複数の種類を取り込むときは、種類ごとに別の取得元にする
- **外部の activity**: 取得元から取り込んだ 1 件。取り込み方は、システムが一覧を取る・オーナーが URL を指名してシステムが題などを取る・オーナーがすべて手で入力する、の 3 通りある（[ADR-0045](../../docs/decisions/0045-external-activity-follows-source.md)）
- **登録していないサイト**: 取得元として登録していないサイト。そこの単発の記事などは、1 つの取得元「登録していないサイト」にまとめる
- **分類**: 一覧での見せ方を分ける値。記事・埋め込み・life event・その他の 4 つ。取得元ごとに 1 つ決まる
- **取得の結果**: 取得元ごとの、最後に取り直した日時・成否・成否の理由・最後に成功した日時
- **life event**: synsk.me の中で作る、人生の出来事の 1 件。題・説明・起きた日・代表画像・識別子を持ち、リンク先を持たない。識別子を含む URL で個別のページを持つ
- **起きた日**: life event の暦の日付（年月日）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 外部のサービスに書いたものを、一覧に自動で取り込む (Priority: P1)

オーナーが外部のサービスに記事やリポジトリを公開すると、システムがその取得元から取り込み、保存する。取り込んだ activity は、取得元のリンクとともに一覧に並ぶ。

**Why this priority**: 外部のサービスでの活動を synsk.me にまとめることが、この機能の目的である。

**Independent Test**: 一覧を自動で取る取得元を 1 つ用意し、取得を走らせて、取得元の項目が保存され、題・URL・公開日を持つことを確かめる。もう一度取得を走らせ、同じ項目が 2 件にならないことを確かめる。

**Acceptance Scenarios**:

1. **Given** 取得元に記事「作り物の記事 A」がある, **When** 取得が走る, **Then** その記事が題・URL・公開日を持つ activity として保存される
2. **Given** 「作り物の記事 A」を取り込んだ, **When** もう一度取得が走る, **Then** 「作り物の記事 A」の activity は 1 件のままである
3. **Given** 取得元が項目の ID を返さない, **When** 同じ URL の項目を取り直す, **Then** activity は 1 件のままである
4. **Given** 取り込んだ activity, **When** 一覧の spec がその activity を並べる, **Then** その activity の分類は、その取得元の分類である

---

### User Story 2 - 取得に失敗しても、一覧を出し続ける (Priority: P1)

取得元が応答しない・エラーを返すとき、システムは保存した前回の値で一覧を出す。1 つの取得元の失敗で、ほかの取得元の取得と一覧の表示を止めない。取得元ごとに、最後の取得の成否を記録する。

**Why this priority**: 外部のサービスの障害で synsk.me の一覧が欠けると、サイト全体が見られなくなる（[SOFTWARE_DESIGN.md](../../docs/SOFTWARE_DESIGN.md) の設計原則 4）。

**Independent Test**: 2 つの取得元のうち 1 つが失敗するようにして取得を走らせ、失敗した取得元の前回の activity が残ること、もう 1 つの取得元が取り込まれること、失敗した取得元の取得の結果に失敗と理由が記録されることを確かめる。

**Acceptance Scenarios**:

1. **Given** 取得元 A の activity を 3 件保存した, **When** 取得元 A の取得が失敗する, **Then** 3 件の activity はそのまま残り、一覧に出る
2. **Given** 取得元 A と取得元 B, **When** 取得元 A の取得が失敗し、取得元 B の取得が成功する, **Then** 取得元 B の activity が取り込まれる
3. **Given** 取得元 A の取得が失敗した, **When** 取得の結果を見る, **Then** 失敗したこと・取り直した日時・失敗の理由・最後に成功した日時が記録されている
4. **Given** 取得元 A の取得が続けて 2 回失敗した, **When** 取得の結果を見る, **Then** 最後に成功した日時は、失敗する前に成功した日時のまま残る

---

### User Story 3 - 取得元で消したものを、一覧から消す (Priority: P1)

オーナーが外部のサービスで記事を消すか非公開にすると、システムはその activity が取得元で消えたと確かめたときに、何も示さずにすぐ一覧から消す。確かめられないあいだは一覧に残す。

**Why this priority**: 外部のデータの公開範囲は外部のサービス側で決める（[ADR-0045](../../docs/decisions/0045-external-activity-follows-source.md)）。オーナーが非公開にした記事が synsk.me に出続けると、その決まりが成り立たない。

**Independent Test**: 取り込んだ activity を取得元で消したと確かめられる状態にして取得を走らせ、一覧からその activity が消えること、消えたと示す表示が出ないことを確かめる。

**Acceptance Scenarios**:

1. **Given** 取り込んだ activity を、取得元で消えたとシステムが確かめた, **When** 訪問者が一覧を見る, **Then** その activity は一覧に無く、消えたことを示す表示も無い
2. **Given** 1 回の取得で返す件数が決まっている取得元（Zenn は 20 件、Medium は 10 件）, **When** 取り直した一覧に、前に取り込んだ activity が無い, **Then** 一覧に無いことだけを根拠に、その activity を一覧から消さない
3. **Given** 1 回の取得で、消えたと判定した activity の件数が上限を超えた, **When** 取得が終わる, **Then** 上限を超えた分の activity は一覧に残る

---

### User Story 4 - URL を指名して、または手で入力して取り込む (Priority: P2)

一覧を自動で取れない取得元の activity は、オーナーが URL を指名し、システムが題などを取る。サーバーから取れない取得元の activity は、オーナーがすべて手で入力する。公開日を返さない取得元の activity には、オーナーが日付を登録する。

**Why this priority**: X・Spotify・CodeSandbox・CodePen は一覧を取る手段が無い（PR #47 の検証記録、2026-09-02 実測）。無ければこれらの活動が一覧に出ない。

**Independent Test**: URL を指名する取得元に URL と日付を登録し、システムが題を取って保存すること、取り直しても登録した日付が変わらないことを確かめる。

**Acceptance Scenarios**:

1. **Given** URL を指名する取得元, **When** オーナーが URL と日付を登録する, **Then** システムが題などを取り、登録した日付を持つ activity として保存される
2. **Given** 公開日を返さない取得元の activity に、オーナーが日付を登録した, **When** 取り直す, **Then** 登録した日付は変わらない
3. **Given** 公開日を返さない取得元, **When** オーナーが日付を入れずに URL を登録する, **Then** 保存されず、日付を入れるよう示される
4. **Given** 登録していないサイトの記事, **When** オーナーがその URL を登録する, **Then** 取得元「登録していないサイト」の activity として保存される
5. **Given** URL を指名して登録した activity か、手で入力して登録した activity, **When** オーナーが synsk.me の側でその activity を削除する, **Then** その activity は削除され、一覧に出ない

---

### User Story 5 - life event を書き、一覧に並べ、個別のページで見せる (Priority: P2)

オーナーは管理画面で life event を作り、題・説明・起きた日・代表画像を入れる。期間のある出来事は、始まりと終わりの 2 件の life event で表す。出したくない life event は削除する。訪問者は、life event の識別子を含む URL で、その life event の個別のページを開ける。

**Why this priority**: 外部のサービスに残らない出来事（入学・転居など）を一覧に置く手段は life event だけである。外部の activity より件数が少なく、無くても一覧は成り立つ。

**Independent Test**: life event を 1 件作り、題・説明・起きた日・代表画像が保存されることと、訪問者としてその識別子の URL で個別のページを開けることを確かめる。その life event を削除し、life event と代表画像のデータが残らないことを確かめる。

**Acceptance Scenarios**:

1. **Given** 管理画面, **When** オーナーが題「作り物の出来事」・説明・起きた日 2020-04-01 を入れて保存する, **Then** その life event が保存される
2. **Given** 管理画面, **When** オーナーが起きた日を入れずに保存する, **Then** 保存されず、起きた日を入れるよう示される
3. **Given** 日の分からない出来事, **When** オーナーが便宜的な日（例: その月の 1 日）を起きた日に入れる, **Then** 保存される
4. **Given** life event が 1 件ある, **When** オーナーが代表画像を登録する, **Then** その画像が代表画像として保存される
5. **Given** life event A と life event B, **When** オーナーが A の代表画像に B の画像を選ぼうとする, **Then** 選べない
6. **Given** 代表画像を持つ life event, **When** オーナーがその life event を削除する, **Then** life event と、その life event の画像のデータが残らない
7. **Given** life event の入力の画面, **When** オーナーがリンク先を入れようとする, **Then** リンク先を入れる項目が無い
8. **Given** life event の作成の画面, **When** オーナーが識別子を入れずに保存する, **Then** 題や起きた日から推測できない uid が識別子になる
9. **Given** life event が 1 件ある, **When** 訪問者がその識別子の URL を開く, **Then** その life event の個別のページが表示される
10. **Given** life event が 1 件ある, **When** オーナーが別の life event の識別子を同じ値に書き換えて保存する, **Then** 保存されない

---

### Edge Cases

- 取得元が同じ項目を ID 付きで返すときは ID で、ID を返さないときは URL で、同じ項目かを判定する
- 公開日を返さない取得元から取り直しても、オーナーが登録した日付を上書きしない
- 取得元が一覧の件数を固定で返すとき（Zenn 20 件、Medium 10 件）、21 件目以降の古い activity は、取り直した一覧に無くても残る
- 取得が失敗しているあいだに取得元で消えた activity は、確かめられるまで一覧に残る
- 期間のある出来事は、始まりの life event と終わりの life event の 2 件で表し、2 件をつなぐ値は持たない
- life event は隠す状態を持たない。出したくないときは削除する
- 取得元の分類を変えると、その取得元のすべての activity の見せ方が変わる。1 件だけ別の分類にはできない

## Requirements *(mandatory)*

### Functional Requirements

**取得元と分類**

- **FR-001**: 取得元は、それぞれ分類を 1 つ持つ。分類は記事・埋め込み・life event・その他のどれかである
- **FR-002**: 外部の activity の分類は、その取得元の分類である。activity 1 件ずつの分類の上書きを持たない
- **FR-003**: 1 つのサービスから複数の種類（例: 記事と本）を取り込むときは、種類ごとに別の取得元にする
- **FR-004**: 取得元ごとの取り方・取る先・後処理は、保管するデータに持たず、取得元ごとの処理に書く。認証情報は保管するデータに持たない
- **FR-005**: 取得元として登録していないサイトの activity は、取得元「登録していないサイト」にまとめ、URL で同じ項目かを判定する

**取得と保存**

- **FR-006**: システムは、一覧を取る取得元から activity を取り込み、保存する
- **FR-007**: 外部の activity は、取得元の URL・題・公開日を持つ。代表の画像の URL と取得元での ID は、取得元が返すときに持つ
- **FR-008**: 同じ取得元の同じ項目は、取り直しても 1 件のままである。取得元が ID を返すときは ID で、返さないときは URL で判定する
- **FR-009**: オーナーは、URL を指名する取得元の activity の URL を登録できる。システムはその URL から題などを取る
- **FR-010**: オーナーは、サーバーから取れない取得元の activity を、URL・題・日付を手で入力して登録できる
- **FR-011**: 公開日を返さない取得元の activity は、オーナーが日付を登録する。日付の無い外部の activity は保存しない
- **FR-012**: 公開日を返さない取得元から取り直すとき、オーナーが登録した日付を上書きしない
- **FR-013**: 外部の activity を初めて取り込んだ日時を記録する
- **FR-036**: システムは、一覧を取る取得元を定期的に自動で取り直す。取り直すのにオーナーの操作を要さない

**取得の失敗**

- **FR-014**: 取得に失敗したときは、保存した前回の値で一覧を出す。失敗した取得元の activity を消さない
- **FR-015**: 1 つの取得元の取得の失敗で、ほかの取得元の取得を止めない
- **FR-016**: 取得元ごとに、最後の取得の結果を 1 つだけ記録する。結果は、取り直した日時・成否・成否の理由・最後に成功した日時を持つ。最後に成功した日時は、失敗が続いても残す

**取得元で消えた activity**

- **FR-017**: 取得元で消えたと確かめた activity は、何も示さずに、待たずに一覧から消す。確かめられないあいだは一覧に残す
- **FR-018**: 1 回の取得で返す件数が決まっている取得元（Zenn・Medium）では、取り直した一覧に無いことを、消えたと判定する根拠にしない
- **FR-019**: 1 回の取得で一覧から消す activity の件数に上限を設ける。消す候補が上限を超えた回は 1 件も消さず、取得の結果の理由に止めた旨を書く
- **FR-020**: 消えたかを判定できないときは、消えていない activity を誤って消すより、消えた activity がしばらく一覧に残る方を選ぶ

**手で付ける値**

- **FR-021**: 外部の activity に、オーナーが手で付ける値（コメント・分類の上書き・非公開への切り替え）を持たない
- **FR-022**: オーナーが外部の activity を一覧に出したくないときは、外部のサービス側で非公開にする。synsk.me の側に 1 件ずつ隠す操作を持たない。URL を指名した activity と手で入力した activity の削除は FR-033 による

**life event**

- **FR-023**: オーナーは管理画面で life event を作り、書き換え、削除できる
- **FR-024**: life event は題・説明・起きた日を持つ。リンク先を持たない
- **FR-025**: 起きた日は年月日で、必ず入れる。日の分からない出来事は、オーナーが便宜的な日を入れる
- **FR-026**: life event は、訪問者に見せない状態を持たない。保存した life event はすべて一覧の対象になる
- **FR-027**: life event を削除すると、その life event と、その life event の画像のデータを一緒に消し、一部だけが残る状態にしない
- **FR-034**: 訪問者は、life event の識別子を含む URL で、その life event の個別のページを開ける。URL に主キーを含めない。外部の activity は個別のページを持たない
- **FR-035**: life event の識別子は 1〜100 文字の英小文字・数字・ハイフンで、ほかの life event と重ならない。作ったときの識別子は、題や起きた日から推測できない uid である。オーナーは識別子を書き換えられる。外部の activity は識別子を持たない

**画像**

- **FR-028**: life event は代表画像を 0 枚か 1 枚持つ。オーナーは代表画像を登録できる
- **FR-029**: life event の代表画像に選べるのは、その life event の画像だけである
- **FR-030**: life event の画像の記録は、note・職歴・実績の画像と同じ仕組みに持つ（[003 の spec](../003-note/spec.md) の Key Entities の「画像」）。画像の置き場を訪問者に直接開かず、サイトを通して出す

**書き換え**

- **FR-031**: life event と、URL を指名した・手で入力した外部の activity を書き換えられるのはオーナーだけである。訪問者は activity・取得元・取得の結果を書き換えられない
- **FR-032**: 取得元から取り込む処理は、外部の activity と取得の結果だけを書き換える。life event を書き換えない
- **FR-033**: オーナーは、URL を指名して登録した activity と手で入力して登録した activity を、synsk.me の側で削除できる（[REQUIREMENTS.md](../../docs/REQUIREMENTS.md) の FR-11）。サーバーから取れない取得元では取得元で消えたことを確かめられず、ほかに一覧から消える経路が無いため

### Key Entities *(include if feature involves data)*

- **取得元**: 取得元の名前と分類を持つ。外部の activity と取得の結果から指される。life event と「登録していないサイト」も、それぞれ 1 つの取得元として持つ
- **activity**: 外部の activity と life event の 1 件。取得元を 1 つ指す。外部の activity は URL・題・公開日を持ち、取得元での ID と代表の画像の URL を持てる。life event は題・説明・起きた日・識別子を持ち、代表画像を持てる。初めて保存した日時と最後に書き換えた日時を持つ
- **取得の結果**: 取得元ごとに 1 つ。取り直した日時・成否・成否の理由・最後に成功した日時を持つ
- **画像**: life event の代表画像。持ち主は 1 つの life event だけである

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 同じ取得元を 2 回続けて取り直したとき、同じ項目の activity が 2 件以上になった件数が 0 件である
- **SC-002**: 取得元の 1 つが失敗する検査のすべてで、その取得元の前回の activity が一覧から失われた件数が 0 件、ほかの取得元の取り込みが止まった件数が 0 件である
- **SC-003**: 取得元で消えたとシステムが確かめた activity のすべてが、確かめた取得の直後から一覧に 0 件出る
- **SC-004**: 1 回の取得で返す件数が決まっている取得元で、取り直した一覧に無いことだけを理由に一覧から消えた activity が 0 件である
- **SC-005**: 公開日を返さない取得元の activity のすべてで、取り直したあとも、オーナーが登録した日付が変わらない
- **SC-006**: 削除した life event のすべてで、その life event と画像のデータが 0 件残る
- **SC-007**: すべての life event について、訪問者がその識別子の URL で個別のページを開ける

## Assumptions

**ほかの spec・文書との関係**

- 一覧の spec が、外部の activity と life event を note・実績・職歴と並べる。並べる日付・順・分類ごとの見せ方は一覧の spec が持つ
- 転載先の URL と一致する外部の activity を一覧から除くことは、一覧の spec が持つ（[ADR-0006](../../docs/decisions/0006-posse-publishing-strategy.md)）
- 画像を収める仕組みは [003 の spec](../003-note/spec.md) が持つ。この spec は life event の画像の要件だけを持つ
- 外部のサービスから受け取ったデータは、受け取った処理の中で synsk.me の形に詰め替える（[SOFTWARE_DESIGN.md](../../docs/SOFTWARE_DESIGN.md) の設計原則 7）
- 取得元から外へ要求を出す処理は、量と回数に上限を設ける（SOFTWARE_DESIGN.md の設計原則 2）。上限の値は plan が持つ
- 管理画面は `/dash/` 配下に置く（[ADR-0016](../../docs/decisions/0016-url-conventions.md)）。オーナーであることは、アプリケーションの外で Cloudflare Access が判定する（[ADR-0013](../../docs/decisions/0013-access-authentication.md)）
- 取得元ごとに取れるもの・取れないものは、PR #47 の検証記録（`docs/scraps/external-api-verification.md`、ブランチ `feature/external-api-verification`、2026-09-02 実測）による

**取得元と分類（2026-10-28 にオーナーが採った）**

- 埋め込み: X の投稿・Spotify のプレイリスト・CodePen・CodeSandbox・Speaker Deck・YouTube の動画
- その他: GitHub のリポジトリ・connpass のイベント・登録していないサイト
- life event: life event
- 記事: 上の 3 つに挙がらない取得元。ADR-0045 の挙げる取得元では Zenn・Qiita・dev.to・Medium が当たる（2026-10-28 の決定は記事の取得元を名指ししていない）
- 取り込み方は ADR-0045 による。一覧を取る: Zenn・Qiita・dev.to・Medium・GitHub・Speaker Deck・connpass。URL を指名する: Spotify・X・CodeSandbox・YouTube。すべて手で入力する: CodePen
- YouTube は URL を指名する（2026-11-04 に決めた。ADR-0045 と PR #47 の検証記録は YouTube を挙げない）。チャンネルの動画一覧を取る公式の手段は YouTube Data API v3 で、API キーが要り、既定の割り当ては 1 日 10,000 単位、超えた要求は拒まれる（[Getting Started](https://developers.google.com/youtube/v3/getting-started)、[Errors](https://developers.google.com/youtube/v3/docs/errors)）。料金を公式の文書で確かめられないため、外への要求の費用を確かめられない（SOFTWARE_DESIGN.md の設計原則 2）。チャンネルの RSS フィード（`https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`）は公式の文書に無く、15 件を返す（2026-11-04 実測）。URL から題を取る oEmbed（`https://www.youtube.com/oembed?url=<URL>`）は公開日を返さない（2026-11-04 実測）ので、日付はオーナーが登録する

**決まっていて、実装のときに詰めるもの**

- 取得元で消えたと判定する条件は実装のときに決める（2026-11-04 のオーナーの回答）。404 の扱いも実装のときに決める
- 取得元で消えた activity を、保管するデータから消すかは実装のときに決める（2026-11-04 のオーナーの回答）。この spec が決めるのは一覧から消すことだけである
- 1 回の取得で一覧から消す件数の上限の値
- 取得のとき、値が変わった activity だけを書くか。取得の頻度は、保管するデータへの 1 日の書き込みの上限（10 万行）を条件にして決める
- 1 回の呼び出しで読む問い合わせをまとめるか
- オーナーが画面から自動取得を止めたくなったときは、その切り替えの印だけを保管するデータに置く

**決定が無く、この spec では決めない**

- 取得の結果をオーナーに見せる画面を持つか
- 外部の activity の代表の画像の出し方
- life event の題を必ず入れるか
- life event の説明の書式と、説明の中に画像を置けるか
- life event の個別のページに出す値と見せ方
- 取得元が題を返さない URL を指名したときの扱い
- 取得元の分類を変える手順
