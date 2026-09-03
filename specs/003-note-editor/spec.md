# Feature Specification: note のエディタ

**Feature Branch**: `003-note-editor`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "note のエディタ。作り手が /dash/ でエディタを開き、題と本文を書き、識別子を決めて公開する。公開済みの note を書き換えて公開し直せる。本文に画像を差し込め、公開後の note でも同じ位置に表示される。画像は synsk.me が保管する。編集中の内容と公開されている内容は別に保持する。"

## Clarifications

### Session 2026-09-03

- Q: 公開前に見た目を確認する画面は、公開後に訪問者が見るのと同じ表示になることを要件にするか → A: 公開後の note と同じ表示を使い、両者が一致することを要件にする

## User Scenarios & Testing *(mandatory)*

### User Story 1 - note を書いて公開する (Priority: P1)

作り手が `/dash/` でエディタを開き、題と本文を書き、識別子を決めて公開する。

**Why this priority**: 書いて出す経路が通らなければ、note は1件も存在しない。他のすべてはこの上に載る。

**Independent Test**: `/dash/` で note を1件書いて公開し、`/notes/{slug}` で読める状態になる。この経路だけで、書いたものが世に出るという価値が成立する。

**Acceptance Scenarios**:

1. **Given** `/dash/` を開いている、**When** 作り手が note を新規に作る、**Then** 題と本文が空の note が作られる
2. **Given** 題と本文を入力した、**When** 作り手が識別子を決めて保存する、**Then** その識別子で note が呼び出せる
3. **Given** 保存済みの note がある、**When** 作り手が公開する、**Then** `/notes/{slug}` で読める状態になる
4. **Given** 公開済みの note がある、**When** 作り手が題と本文を書き換えて公開し直す、**Then** 書き換えた内容が `/notes/{slug}` に出る
5. **Given** 題を入力した、**When** 識別子の入力に移る、**Then** 題から作られた識別子の候補が示され、作り手が確定させる
6. **Given** 編集中の note がある、**When** 作り手が公開前の見た目を確認する、**Then** 公開後に訪問者が見るのと同じ表示になる

### User Story 2 - 本文に画像を含める (Priority: P2)

作り手が編集中の本文に画像を差し込み、公開後の note でその画像が表示される。

**Why this priority**: 画像がなくても note は成立する。ただし画像を扱えないと、書ける内容が文章だけに限られる。

**Independent Test**: 編集中の本文に画像を1枚差し込み、公開後の note で同じ位置に表示される。文章だけの note が既に出せる状態の上に、独立して載せられる。

**Acceptance Scenarios**:

1. **Given** 編集中の note がある、**When** 作り手が本文に画像を追加する、**Then** 編集中の画面で本文の中に表示される
2. **Given** 画像を含む note を公開した、**When** 訪問者がその note を開く、**Then** 編集中と同じ位置に画像が表示される
3. **Given** 公開済みの note から画像を外した、**When** 訪問者がその note を開く、**Then** その画像は現れない

### Edge Cases

- 識別子を決めずに保存しようとしたとき、何が足りないかが分かる
- 既に使われている識別子を指定したとき、その識別子が使えないことが分かる
- 画像の追加に失敗したとき、本文の編集内容が失われない
- 参照されなくなった画像が、note の公開後にどう扱われるかが分かる

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 作り手は `/dash/` 配下で note を作成・編集できる
- **FR-002**: note は英数字とハイフンからなる識別子を持ち、識別子は note ごとに一意である
- **FR-003**: 題から識別子の候補が提示され、作り手が確定させる
- **FR-004**: 本文に画像を追加でき、本文中の位置を保って表示される
- **FR-005**: 追加した画像は synsk.me が保管し、外部のサービスに置かない
- **FR-006**: note から画像を外すと、公開された note にその画像が現れない
- **FR-007**: 画像の追加に失敗しても、編集中の本文は保持される
- **FR-008**: 編集中の内容と、公開されている内容は別に保持される
- **FR-009**: 公開する前に、公開後に訪問者が見るのと同じ表示で見た目を確認できる

### Key Entities

- **note**: 識別子、題、本文、可視性を持つ
- **メディア**: 画像などのファイル。1件の note から参照される

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 作り手が、外部のサービスを経由せずに note を書き、画像を含めて公開できる
- **SC-002**: 公開した note の画像が、訪問者の画面で本文中の意図した位置に表示される
- **SC-003**: note を書き換えても、公開済みの URL が変わらない

## Assumptions

- note の保管先は `docs/decisions/0014-authoring-and-datastore.md` が定める。この機能は保管の形式を決めない
- 認証は `docs/decisions/0013-access-authentication.md` が定めるアプリケーションの外の仕組みによる。この機能は認証を持たない
- 扱うメディアは画像とする。動画と音声はこの機能に含めない
