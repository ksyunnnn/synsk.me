# Feature Specification: note の一覧と詳細

**Feature Branch**: `001-notes-list-detail`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "note の一覧と詳細。訪問者が /notes を開き、公開されている note の一覧から1件を選んで /notes/{slug} で本文を読む。一覧は公開日の新しい順。更新日は詳細にだけ出す。下書きは扱わない。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - note を見つけて読む (Priority: P1)

訪問者が `/notes` を開き、公開されている note の一覧から1件を選んで本文を読む。

**Why this priority**: この経路が通らなければ note は誰にも届かない。他のすべてはこの上に載る。

**Independent Test**: `/notes` を開いて一覧から1件を選び、本文が読める。この経路だけで、書いたものが訪問者に届くという価値が成立する。

**Acceptance Scenarios**:

1. **Given** 公開されている note が複数ある、**When** 訪問者が `/notes` を開く、**Then** note の題と公開日が公開日の新しい順に並ぶ
2. **Given** `/notes` が開いている、**When** 訪問者が一覧の1件を選ぶ、**Then** `/notes/{slug}` が開き、題・公開日・本文が表示される
3. **Given** その note が公開後に更新されている、**When** 訪問者が `/notes/{slug}` を開く、**Then** 公開日に加えて更新日が表示される
4. **Given** 存在しない slug、**When** 訪問者がその URL を開く、**Then** note がないことが伝わる表示になる

### Edge Cases

- 公開されている note が1件もないとき、一覧は空であることが分かる表示になる
- 末尾にスラッシュを付けた URL（`/notes/`）は、スラッシュのない URL へリダイレクトされる
- 公開後に一度も更新されていない note は、`/notes/{slug}` に更新日を表示しない
- 下書きの note は、一覧にも詳細にも現れない

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/notes` は公開されている note の題と公開日を、公開日の新しい順に並べる
- **FR-002**: `/notes/{slug}` は1件の note の題・公開日・本文を表示する
- **FR-003**: 公開後に更新された note は、`/notes/{slug}` に更新日を表示する
- **FR-004**: 一覧の各項目から、その note の `/notes/{slug}` へ移動できる
- **FR-005**: slug は英数字とハイフンで構成し、note ごとに一意である
- **FR-006**: note の URL は末尾にスラッシュを持たない。末尾にスラッシュを付けた要求は、スラッシュのない URL へリダイレクトする
- **FR-007**: 存在しない slug への要求は、note がないことを訪問者に伝える
- **FR-008**: 一覧と詳細に現れるのは公開されている note だけとし、下書きは現れない

### Key Entities

- **note**: slug、題、公開日、更新日、本文を持つ。公開日は初めて公開した日を指す

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 訪問者は `/notes` から、公開されている任意の note の本文に到達できる
- **SC-002**: note の題を変えても、その note の URL は変わらない
- **SC-003**: 下書きの note が、一覧と詳細のどちらにも現れない

## Assumptions

- note の保管先は `docs/decisions/0014-authoring-and-datastore.md` が定める。この機能は保管の形式を決めない
- note を作成・編集する画面をこの機能は持たない
- 公開前に見た目を確認する手段をこの機能に含めない
- 検索・タグ・ページネーション・RSS をこの機能に含めない
