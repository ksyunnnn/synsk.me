# Feature Specification: 職務経歴書の出力

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 相手に渡す職務経歴書を作る (Priority: P1)

作り手が `/dash/` で職務経歴書を1件作り、含める career と project を選び、識別子を決めて保存する。

**Why this priority**: 版が作れなければ渡すものが存在しない。他のすべてはこの上に載る。

**Acceptance Scenarios**:

1. `/dash/` から職務経歴書を新規に作れる
2. 保持している career と project から、その版に含めるものを選べる
3. 識別子を決めて保存すると、その識別子で版を呼び出せる
4. 同じ識別子を持つ版を2つ作れない

### User Story 2 - 職務経歴書を渡す (Priority: P2)

作り手が版の URL を相手に渡し、相手がその URL を開いて内容を読む。

**Why this priority**: 作った版を届けられなければ、複数持つ意味がない。

**Acceptance Scenarios**:

1. 版の URL を開くと、その版に含まれる career と project が読める
2. 公開できない値を持つ career は、公開できる値に置き換わって表示される
3. 非公開の版の URL を開いても内容は読めない

### User Story 3 - 版を作り直す (Priority: P3)

作り手が既存の版の内容と公開範囲を変える。

**Why this priority**: 経歴は増える。作り直せなければ版が古くなる。

**Acceptance Scenarios**:

1. 既存の版に含める career と project を変えられる
2. 版の公開範囲を、公開 / 限定公開 / 非公開のいずれかに設定できる
3. 版を非公開に戻しても、その版は消えない

### Edge Cases

- career を1つも含めない版を保存しようとしたとき、何が起きるかが分かる
- 版に含めた career が削除されたとき、その版の表示がどうなるかが分かる
- 存在しない識別子の URL を開くと、その版がないことが伝わる

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 職務経歴書を複数保持できる
- **FR-002**: 各版は英数字とハイフンからなる識別子を持ち、識別子は版ごとに一意である
- **FR-003**: 版は permalink を持ち、URL は末尾にスラッシュを持たない
- **FR-004**: 版に含める career と project を、保持しているものから選べる
- **FR-005**: 版は公開 / 限定公開 / 非公開のいずれかの状態を取る
- **FR-006**: 公開できない値を持つ career は、公開の版では公開できる値で表示される
- **FR-007**: 版の作成と編集は `/dash/` 配下で行う
- **FR-008**: 非公開に戻した版は削除されない
- **FR-009**: 存在しない識別子への要求は、その版がないことを閲覧者に伝える

### Key Entities

- **職務経歴書**: 識別子、題、可視性、含める career と project の参照を持つ
- **career**: 職歴。公開できない値と公開できる値を対で持つ
- **project**: 実績。career を参照する

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 作り手が、既存の版を複製せずに新しい版を作り、相手に渡せる状態にできる
- **SC-002**: 公開の版に、公開できない値が1件も現れない
- **SC-003**: 版を増やしても、既存の版の URL と内容が変わらない

## Assumptions

- career と project は既に保持されている。この機能はそれらを作る手段を持たない
- 限定公開を閲覧させる仕組み（認証、共有リンク）はこの機能の対象外とする
- 出力の形式は画面上の表示とする。ファイルとして書き出す手段はこの機能に含めない
