# Feature Specification: timeline

**Feature Branch**: `004-timeline`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "timeline — 外部プラットフォームの activity を自動で取得して永続化し、synsk.me 上で時系列に一覧表示する。docs/REQUIREMENTS.md の FR-01・FR-02・FR-06・FR-09 に紐づく。GitHub Issue #85 が対象。"

## Clarifications

### Session 2026-09-08

- Q: timeline をどの経路に置くか → A: 経路を決めない。timeline は固有の経路を持たない表示単位とし、どのページに置くかはこの spec の外に置く
- Q: 再取得したとき同じ activity と判定する根拠に何を使うか → A: プラットフォームが不変の ID を返すならそれを使い、返さないものは取得元の URL を使う
- Q: 掲載するプラットフォームの集合をどう定めるか → A: API を持つプラットフォームは実装を足して集合に加える。単発の外部記事は `external` の受け皿から管理画面で載せる

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 訪問者が活動を時系列で読む (Priority: P1)

訪問者が synsk.me を開き、作り手が外部のプラットフォームに出したもの（記事・リポジトリ・登壇資料・イベント参加など）を、新しい順に並んだ1つの流れとして読む。気になったものを選ぶと、取得元のページへ移る。

**Why this priority**: 訪問者から見た timeline の価値はここで完結する。取得も永続化も、この画面が成立するための手段である。

**Independent Test**: 永続化済みの activity が数件ある状態で timeline を開き、新しい順に並び、各エントリから取得元へ移れる。取得の自動化が無くても、この経路だけで価値が成立する。

**Acceptance Scenarios**:

1. **Given** 公開状態の activity が複数件ある、**When** 訪問者が timeline を開く、**Then** 新しい順に並んだ一覧が表示される
2. **Given** timeline を開いている、**When** 訪問者がエントリを選ぶ、**Then** 取得元のページへ移る
3. **Given** activity が1件も無い、**When** 訪問者が timeline を開く、**Then** 空であることが分かる表示になり、エラーにならない
4. **Given** 公開日を持たない activity がある、**When** 訪問者が timeline を開く、**Then** その activity も一覧の中に並ぶ

---

### User Story 2 - 外部の活動が自動で集まり、消えても残る (Priority: P2)

作り手が外部のプラットフォームに何かを出すと、synsk.me が自動で取り込む。取得元から記事が消えても、サービスが終了しても、timeline からは消えない。取得に失敗したプラットフォームがあっても、他のプラットフォームの activity は表示される。

**Why this priority**: 手で登録するだけでも User Story 1 は成立する。自動で集まることで、作り手が synsk.me へ転記する手間が消える。

**Independent Test**: 取得を1回走らせ、外部のプラットフォームの activity が永続化されることを確かめる。取得元からその activity を消しても timeline に残る。

**Acceptance Scenarios**:

1. **Given** 取得の対象となるプラットフォームがある、**When** 取得が走る、**Then** そのプラットフォームの activity が永続化される
2. **Given** 永続化済みの activity がある、**When** 同じ activity をもう一度取得する、**Then** 新しいレコードは増えず、既存のレコードが更新される
3. **Given** 永続化済みの activity がある、**When** 取得元からその activity が消える、**Then** timeline にはそのまま残る
4. **Given** 複数のプラットフォームを取得する、**When** そのうち1つの取得が失敗する、**Then** 残りのプラットフォームの activity は永続化され、timeline に表示される
5. **Given** 訪問者が timeline を開く、**When** 表示が行われる、**Then** 外部のプラットフォームへの取得は発生しない

---

### User Story 3 - 作り手が timeline の見え方を手で直す (Priority: P3)

作り手が、取り込まれた activity にコメントを添える、表示の分類を上書きする、公開したくないものを非公開へ戻す。次の取得が走っても、それらは失われない。

**Why this priority**: 自動で集めたものをそのまま出すだけでも timeline は成立する。手で直せることが、出したくないものを消さずに取り下げる唯一の手段になる。

**Independent Test**: activity を1件非公開にし、次の取得の後も非公開のままであること、訪問者の画面に現れないことを確かめる。

**Acceptance Scenarios**:

1. **Given** 公開状態の activity がある、**When** 作り手が非公開にする、**Then** 訪問者の timeline に現れない
2. **Given** 非公開にした activity がある、**When** 取得が走る、**Then** 非公開のまま保たれる
3. **Given** 作り手がコメントを付けた activity がある、**When** 取得が走り取得元の内容が変わっている、**Then** 取得元由来の値は更新され、コメントは保たれる
4. **Given** 作り手が表示の分類を上書きした activity がある、**When** 取得が走る、**Then** 上書きした分類が保たれる

---

### Edge Cases

- 取得元が識別子を変えたとき（利用者名の変更、カスタムドメインへの移行など）、同じ activity が二重に並ばない
- 公開日を返さないプラットフォームの activity が、並び順の中で位置を持つ
- 取得が途中で失敗したとき、途中まで取り込んだ内容が壊れた状態で残らない
- 同じ activity を2つのプラットフォームに出したとき、それぞれが別のエントリとして並ぶ
- 取得元が公開日を後から変えたとき、並び順が追随する

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: timeline は、永続化された activity を公開日の新しい順に一覧する
- **FR-002**: 外部プラットフォームの activity を、作り手の操作を要さずに取得し、永続化する
- **FR-003**: 訪問者の閲覧は、永続化された値だけを読む。表示のたびに外部のプラットフォームへ取得しない
- **FR-004**: 同一の外部 activity を再取得したとき、既存のレコードを更新し、重複したエントリを作らない
- **FR-005**: 再取得しても、手で付けた情報（コメント、表示の分類の上書き、可視性）が保たれる
- **FR-006**: 取得元から消えた activity も、timeline に残る
- **FR-007**: 一部のプラットフォームの取得に失敗しても、他のプラットフォームの activity は表示される
- **FR-008**: 公開済みの activity を、データを保持したまま非公開にできる
- **FR-009**: 非公開の activity は、訪問者が到達できるどの経路にも現れない
- **FR-010**: timeline の各エントリは、取得元へ直接リンクする。synsk.me 上に固有の URL を持たない
- **FR-011**: 公開日を返さないプラットフォームの activity も、時系列の一覧の中に位置を持つ
- **FR-012**: activity が1件も無い状態、取得に失敗した状態でも、timeline の画面が成立する
- **FR-013**: timeline は固有の経路を持たない。複数の経路に置ける表示単位である
- **FR-014**: 同一性は、プラットフォームが返す不変の ID を根拠に判定する。ID を返さないプラットフォームは取得元の URL を根拠にする
- **FR-015**: 取得の経路を持つプラットフォームは、集合に列挙された対象として扱う
- **FR-016**: 集合に列挙されていない発信元の記事を、作り手が題・URL・公開日を入力して timeline に載せられる
- **FR-017**: FR-016 で載せた activity は、取得元へ直接リンクし、時系列の一覧に並ぶ

### Key Entities

- **activity**: 作り手が外部のプラットフォームに出したもの1件。題、取得元の URL、公開日、種別、取得元のプラットフォーム、可視性、手で付けた情報を持つ
- **プラットフォーム**: activity の取得元。取得の可否と、公開日・識別子を返すかがプラットフォームごとに異なる
- **取得の結果**: 1回の取得における、プラットフォームごとの成否とその理由。取得できなかったことを画面の表示と切り分けるために持つ

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 訪問者が1つの画面で、作り手が複数のプラットフォームに出したものを新しい順に読める
- **SC-002**: 取得元から activity が消えた後も、timeline に残る
- **SC-003**: プラットフォーム1つの取得が失敗しても、残りの activity が表示される
- **SC-004**: 手で付けた情報が、再取得の後も 100% 保たれる
- **SC-005**: 非公開にした activity が、訪問者の到達するどの経路にも現れない
- **SC-006**: timeline を含むページが `docs/REQUIREMENTS.md` の NFR-03〜NFR-07（LCP・INP・CLS・TTFB・FCP）を満たす
- **SC-007**: 作り手が外部のプラットフォームに出したものが、synsk.me へ転記する操作なしに timeline に現れる

## Assumptions

- 同一性の根拠は、2026-09-08 の実測による。不変の ID を返すのは Qiita（`d5af0c1e2e3b8722c868`）・dev.to（`1715490`）・GitHub（`570852956`）・connpass・Medium（RSS の guid `https://medium.com/p/55fef51df50c`、`isPermaLink="false"`）。Zenn と Speaker Deck は RSS の guid が記事の URL そのもの（`isPermaLink="true"`）で、ユーザー名を含む
- Zenn と Speaker Deck に URL 以外の識別子を得る手段があるかは確かめていない。実装に着手する時点で確かめる
- 集合に列挙されていない発信元の題・サムネイルを URL から自動で読めるとは限らない。2026-09-02 の実測では CodePen が全経路 403、CodeSandbox は oEmbed と `og:image` が 403 だった。作り手が手で書ける形を前提とする
- 保管先は `docs/decisions/0014-authoring-and-datastore.md` が定める。テーブルとカラムの形は #72「D1 のスキーマを決める」が持つ。この spec は保管の形式を決めない
- 公開日を返さないプラットフォーム（2026-09-07 の検証では Spotify・CodeSandbox・CodePen・X）は、取得した時刻を並び順の根拠とする。作り手が手で上書きできる
- エントリの見た目は #77「timeline の EntryUI を決める」が持つ。この spec は見た目を決めない
- 取得を走らせる周期と契機は実装が決める。この spec は「訪問者の閲覧が外部への取得を起こさない」（FR-003）だけを要求する
- timeline をどのページに置くかは #86「工事中を外し、timeline と note を公開する」が持つ
- 認証を要する画面（可視性の切り替え、コメントの付与）は `/dash/` 配下に置かれ、認証は `docs/decisions/0013-access-authentication.md` が定めるアプリケーションの外の仕組みによる
- 手で登録する activity（取得の経路を持たないプラットフォーム）を扱えることを前提とする。ADR-0009 の判断の時点で X の API は有料化されており、自動取得の対象から外れている
