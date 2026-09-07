# Feature Specification: 職務経歴書の出力

**Feature Branch**: `002-resume-output`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "職務経歴書の出力。作り手が /dash/ で職務経歴書を複数作り、含める career と project を選び、識別子を決めて保存する。版の URL を相手に渡すと、相手がその URL で内容を読める。版ごとに公開 / 限定公開 / 非公開を設定できる。公開できない値を持つ career は、公開の版では公開できる値で表示される。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 相手に渡す職務経歴書を作る (Priority: P1)

作り手が `/dash/` で職務経歴書を1件作り、含める career と project を選び、識別子を決めて保存する。

**Why this priority**: 版が作れなければ渡すものが存在しない。他のすべてはこの上に載る。

**Independent Test**: `/dash/` で版を1件作り、識別子で呼び出せる。この経路だけで、相手に渡せる版が手元に存在するという価値が成立する。

**Acceptance Scenarios**:

1. **Given** career と project を保持している、**When** 作り手が `/dash/` から職務経歴書を新規に作る、**Then** 空の版が作られる
2. **Given** 版を編集している、**When** 作り手が保持している career と project から含めるものを選ぶ、**Then** その版に含まれる
3. **Given** 版に識別子を与えて保存した、**When** その識別子を指定する、**Then** その版が呼び出せる
4. **Given** ある識別子の版が既にある、**When** 同じ識別子で別の版を作ろうとする、**Then** その識別子が使えないことが分かる

### User Story 2 - 職務経歴書を渡す (Priority: P2)

作り手が版の URL を相手に渡し、相手がその URL を開いて内容を読む。

**Why this priority**: 作った版を届けられなければ、複数持つ意味がない。

**Independent Test**: 公開した版の URL を開き、含まれる career と project が読める。作り手以外の目に届くところまでを1本で確かめられる。

**Acceptance Scenarios**:

1. **Given** 公開の版がある、**When** その URL を開く、**Then** 版に含まれる career と project が読める
2. **Given** 公開できない値を持つ career を含む公開の版、**When** その URL を開く、**Then** その career は公開できる値に置き換わって表示される
3. **Given** 非公開の版がある、**When** その URL を開く、**Then** 内容は読めない

### User Story 3 - 版を作り直す (Priority: P3)

作り手が既存の版の内容と公開範囲を変える。

**Why this priority**: 経歴は増える。作り直せなければ版が古くなる。

**Independent Test**: 既存の版に含める career と project を差し替え、公開範囲を変えて、変更が版に反映される。

**Acceptance Scenarios**:

1. **Given** 既存の版がある、**When** 含める career と project を変える、**Then** 変更後の内容で版が読める
2. **Given** 既存の版がある、**When** 公開範囲を公開 / 限定公開 / 非公開のいずれかに設定する、**Then** その設定が版に反映される
3. **Given** 公開していた版を非公開に戻した、**When** その版を `/dash/` で見る、**Then** 版は消えずに残っている

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
