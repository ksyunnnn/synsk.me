# Data Model: 職務経歴書

表・列・型・CHECK・外部キーの正本は `migrations/` にある。この文書は、`migrations/0001`〜`0010` を当てたスキーマを、spec の要件と、アプリケーションが守る決まりに対応させる。0006 の `resume_career.organization_name` と `resume_project.title` の注釈より、0008 の冒頭の注釈を正とする。列の一覧は書き写さない。

## Contents

- 表と spec の対応
- 秘匿化していたかの列
- アプリケーションが守る決まり
- 状態の切り替え
- 写し方
- domain の型
- 訪問者向けの DTO

---

## 表と spec の対応

| 表 | spec の実体 | 002 が書くか | 主な要件 |
|---|---|---|---|
| `resume` | 職務経歴書 | 書く | FR-001〜FR-004、FR-011〜FR-015、FR-019〜FR-023、FR-037〜FR-040 |
| `resume_career` | 写した職歴 | 書く | FR-007〜FR-010、FR-016〜FR-018、FR-031 |
| `resume_project` | 写した実績 | 書く | 同上 |
| `resume_education` | 写した学歴 | 書く | FR-007、FR-009、FR-024 |
| `resume_project_skill` | 写したスキル | 書く | FR-025・FR-026 |
| `resume_skill_override` | 写した経験年数の上書き | 書く | FR-028 |
| `organization`・`career`・`project`・`project_skill`・`skill`・`education` | 写し元 | 読むだけ（作るときと、作成の画面の選択肢） | FR-005・FR-007・FR-008・FR-010・FR-016 |

写し元の行を消すときに、写した行の `*_id` を NULL にするのは 001 の削除の処理が持つ（001 の research.md の R8）。002 は写した行の `*_id` を書き換えない。

スキーマが守る決まり（002 のコードで重ねて書かない）: 識別子の形と重複（`resume.slug` の CHECK と UNIQUE、FR-002）、限定公開用か公開用かの既定（`resume.audience` の DEFAULT `limited`、FR-003）、作った後に変えないこと（トリガ `resume_audience_fixed`、FR-004）、公開用が 1 つだけ（部分 UNIQUE 索引 `resume_public`、FR-019）、公開用は期限を持たないこと（`resume` の CHECK、FR-020）、状態の既定が下書き（`resume.status` の DEFAULT `draft`、FR-021）、期限の形（`limited_expires_at` の CHECK、FR-013）、写した期間の形と前後、写した種類の 4 値、同じ実績に同じスキル名を 2 回持たないこと（`resume_project_skill` の主キー、Key Entities）、スキルごとに上書きを 1 つ（`resume_skill_override` の主キー）。

アプリケーションは、スキーマが拒む入力を保存の前にも確かめ、画面で項目ごとに知らせる。スキーマの制約は最後の守りとして残す。

## 秘匿化していたかの列

`resume_career.is_masked` と `resume_project.is_masked`（migration 0008、既定 1）は、写した職歴・実績が作ったときに秘匿化していたかを持つ。作るときに写し元の `is_masked` を写す。公開用で、次の 3 つを決めるのにこの値を使う。限定公開用はこの値を使わない。

- 本文を伏せた見た目で出し、本文の中身・画像・関連 URL を応答に含めないこと（FR-017）
- 訪問者に出してよい値を、秘匿化した職歴・実績では許可リストに絞ること（FR-018）
- オーナーが職務経歴書の中で本文や関連 URL を直しても、秘匿化した職歴・実績では出さないこと（FR-031 は秘匿化するかどうかを変えられないとする）

写し元の `is_masked` を表示のときに読む形は、写し元を直すと変わり、写し元を消すと読めないため FR-007・FR-016 と食い違う。そのため写した行に持つ。

## アプリケーションが守る決まり

| 決まり | 要件 | 置き場 |
|---|---|---|
| 限定公開用の識別子は uid で、書き換えを拒む | FR-037 | `src/features/resume/domain/resume.ts` |
| 公開用の識別子の既定は uid。書き換えは FR-002 の形と重複を確かめる | FR-002・FR-039 | 同上 |
| 2 つ目の公開用は、保存の前に拒む | FR-019 | 作成のユースケース。索引 `resume_public` は最後の守り |
| 限定公開用の URL は識別子（uid）だけで作る。出し直すと識別子を新しい uid に書き換える | FR-011・FR-012・FR-040 | `src/features/resume/domain/resume.ts` の `newResumeSlug`（research.md の R5） |
| 中身を返すのは、識別子が合い、訪問者に見せる状態で、限定公開用なら期限の前か期限が無いときだけ | FR-014・FR-020・FR-022・FR-023 | 訪問者向けの取り出しの SQL の WHERE（research.md の R6） |
| 作るとき、写し方を限定公開用か公開用かで分ける | FR-008・FR-010・FR-016 | `src/features/resume/domain/build-resume.ts`（下の「写し方」） |
| 公開用に、秘匿化した組織名の無い組織を指す秘匿化した職歴・実績を写さない | FR-016、constitution II | 同上。写せなければ作らずに知らせる |
| 公開用に、サイトに載せない（`career.status`・`project.status` が `draft`）職歴・実績を写さない。作成の画面で公開用を選んだら、選択肢から外す。限定公開用は `status` を見ない | FR-005・FR-010・FR-016 | 同上と作成の画面（tasks.md の T067・T068）。限定公開用は作成の選択肢と写し方が `status` を読まない形のまま |
| 並びは始まりの日の新しい順。同じ日は id の順 | FR-009 | 取り出しの SQL の ORDER BY |
| スキルの一覧は、写したスキルの名前を 1 つにまとめる | FR-026 | `src/features/resume/domain/`。名前の比べ方は plan.md の U11 |
| 経験年数は写した実績の期間から求め、写した上書きがあればそれを使う。保存しない | FR-027・FR-028 | `src/shared/domain/period.ts` の計算（001 の T061）を呼ぶ。数え方は 001 の FR-033 |
| 職務経歴書の中の保存は、開いたときの `resume.updated_at` と一致するときだけ書く | FR-038 | Repository の実装（research.md の R8） |
| 作ったあとに足すときは、作るときと同じ写し方で写す。写し済みの元の行は選択肢から外し、送られても足さない。写した経験年数の上書きは、同じ名前の上書きが無いものだけを入れる | FR-041 | 足すユースケースと `build-resume.ts`、Repository の実装（research.md の R14） |
| 削除は子の行から消す | FR-033、REQUIREMENTS.md の FR-11 | Repository の実装（research.md の R9） |

## 状態の切り替え

| 切り替え | 起きること |
|---|---|
| 作る | `status` は `draft`。識別子は uid。期限はオーナーが選ぶ（空なら期限なし） |
| 職歴・実績・学歴を足す | 選んだ元の行を、足したときの値で写した行として足す。既にある写した行と状態・期限・識別子は変わらない（FR-041） |
| `draft` → `published` | 公開用は、`/resume/{slug}` で読める。限定公開用は、期限の前なら `/resume/{slug}` で読める |
| `published` → `draft` | どちらも中身を返さなくなる。行は残る |
| 期限を変える（限定公開用） | 過ぎた期限を先の日時にすると、同じ URL でもう一度読める（FR-014）。空にすると期限なし |
| 識別子を変える（公開用だけ） | 古い識別子の URL は 404 になる |
| URL を出し直す（限定公開用だけ） | 識別子を新しい uid に書き換える。古い識別子の URL は 404 になる。状態と期限は変わらない（FR-040） |
| 限定公開用 ↔ 公開用 | できない（トリガが拒む。画面に入力を出さない） |

キャッシュを持たないため、切り替えを保存した直後の要求から新しい状態で出る（research.md の R7）。

## 写し方

`build-resume.ts` は、読み込んだ写し元と、選んだ id と、限定公開用か公開用かを受け取り、写す行を返す副作用の無い関数にする（docs/SOFTWARE_DESIGN.md の「読む → 計算 → 書く」）。作ったあとに足すときも、同じ関数で写す（FR-041）。

| 写す先の列 | 限定公開用 | 公開用で秘匿化しない | 公開用で秘匿化した |
|---|---|---|---|
| `resume_career.organization_name` | `organization.name` | `organization.name` | `organization.name_masked` |
| `resume_project.organization_name` | `organization.name` | `organization.name` | `organization.name_masked` |
| `resume_project.title` | `project.title` | `project.title` | `project.title_masked` |
| `description`・`url` | 写す | 写す | 写さない（NULL）。spec の「実装のときに決める」を、写さない方に決める（research.md の R4） |
| 期間・肩書・種類・学歴の列 | 写す | 写す | 写す |
| `resume_project_skill.skill_name` | 実績につないだ `skill.name` | 同じ | 同じ |
| `resume_skill_override` | 写した実績のスキルのうち、`skill.months_override` を持つもの | 同じ | 同じ |
| 写し元の id（`career_id`・`project_id`・`education_id`） | 写す | 写す | 写す |

公開用の 2 つの列は、作ったときにサイトに載せる（`status` が `published`）写し元だけに当たる。サイトに載せない写し元は、公開用では行ごと写さない。限定公開用は、サイトに載せるかどうかに関わらず、選んだ写し元を写す（FR-010・FR-016）。

## domain の型

`src/features/resume/domain/` に置く。行の型は Repository の実装の中だけに置き、ここへ詰め替える（001 の research.md の R3）。

- `Resume`: id・題・識別子・限定公開用か公開用か・下書きか訪問者に見せるか・期限（空あり、限定公開用だけ）・作った日時・直した日時
- `ResumeAudience`: `limited`・`public` の `as const` の配列から作る型。`ResumeStatus` も同じ形で `draft`・`published`
- `ResumeCareer`: id・写し元の id（空あり）・組織名・肩書・期間・本文（空あり）・関連 URL（空あり）
- `ResumeProject`: id・写し元の id（空あり）・組織名・種類・題・期間・本文（空あり）・関連 URL（空あり）・スキルの名前の並び
- `ResumeEducation`: id・写し元の id（空あり）・学校・学部（空あり）・期間・備考（空あり）
- `ResumeSkill`: 名前・経験年数（求めた値か写した上書き）。保存しない
- `Profile`: 氏名・自己紹介・メールアドレス（空あり）。コードの定数と環境変数から作る（research.md の R10）
- `Period`・`CalendarDate`: `src/shared/domain/period.ts`（001 の T015）を使う

## 訪問者向けの DTO

訪問者に渡す形は [contracts/visitor-resume.md](./contracts/visitor-resume.md) が持つ。
