# Feature Specification: notes の一覧と詳細

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 記事を見つけて読む (Priority: P1)

訪問者が `/notes` を開き、公開されている記事の一覧から1件を選んで本文を読む。

**Why this priority**: この経路が通らなければ記事は誰にも届かない。他のすべてはこの上に載る。

**Acceptance Scenarios**:

1. `/notes` を開くと、公開されている記事の題が新しい順に並ぶ
2. 一覧の記事を選ぶと `/notes/{slug}` が開き、題と本文が表示される
3. 存在しない slug を開くと、記事がない旨の表示になる

### Edge Cases

- 記事が1件もないとき、一覧は空であることが分かる表示になる
- 末尾にスラッシュを付けた URL（`/notes/`）でも同じ内容に到達する

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/notes` は公開されている記事の題と公開日を、公開日の新しい順に並べる
- **FR-002**: `/notes/{slug}` は1件の記事の題・公開日・本文を表示する
- **FR-003**: 一覧の各項目から、その記事の `/notes/{slug}` へ移動できる
- **FR-004**: slug は英数字とハイフンで構成し、記事ごとに一意である
- **FR-005**: 記事の URL は末尾にスラッシュを持たない
- **FR-006**: 存在しない slug への要求は、記事がないことを訪問者に伝える

### Key Entities

- **記事**: slug、題、公開日、本文を持つ

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 訪問者は `/notes` を開いてから2回以内の操作で任意の記事の本文に到達できる
- **SC-002**: 記事の題を変えても、その記事の URL は変わらない

## Assumptions

- 記事の内容はリポジトリ内の静的なファイルが持つ。データベースは使わない
- 記事の作成・編集の画面は含まない。認証も含まない
- 検索・タグ・ページネーション・RSS は含まない
- 表示するのは公開されている記事だけとし、下書きと限定公開は扱わない
