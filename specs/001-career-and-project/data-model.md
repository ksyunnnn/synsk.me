# Data Model: 職歴と実績

表・列・型・CHECK・外部キーの正本は `migrations/` にある。この文書は、`migrations/0001`〜`0007` とブランチ `feature/72-schema-adjustments` の `migrations/0008_rebuild_career_and_project.sql`（コミット `4704df4`）を当てたスキーマを、spec の要件と、アプリケーションが守る決まりに対応させる。列の一覧は書き写さない。

## Contents

- 表と spec の対応
- アプリケーションが守る決まり
- 状態の切り替え
- domain の型
- 訪問者向けの DTO

---

## 表と spec の対応

| 表 | spec の実体 | 001 が書くか | 主な要件 |
|---|---|---|---|
| `organization` | 組織 | 書く | FR-001〜FR-006、FR-041 |
| `career` | 職歴 | 書く | FR-007〜FR-010、FR-042 |
| `project` | 実績 | 書く | FR-011〜FR-018、FR-042、FR-043 |
| `project_skill` | 実績とスキルのつながり | 書く | FR-032 |
| `skill` | スキル | 書く | FR-031、FR-033、FR-034 |
| `education` | 学歴 | 書く | FR-036、FR-037 |
| `media` | 画像（持ち主が職歴か実績の行） | 書く（R14 の未決が解けてから） | FR-027〜FR-030 |
| `resume_career`・`resume_project`・`resume_education` | 職務経歴書の写し | 削除のときに `*_id` を NULL にするだけ | spec の Edge Cases |

スキーマが守る決まり（001 のコードで重ねて書かない）: 組織名の重複（`organization.name` の UNIQUE、FR-003）、スキル名の大文字と小文字だけの重複（`skill.name` の `COLLATE NOCASE` の UNIQUE、FR-031）、識別子の形と重複（`project.slug` の CHECK と UNIQUE、FR-013）、種類（`project.kind` の CHECK、FR-012）、日付の形と前後（`*_on` の CHECK、FR-038・FR-039）、既定で秘匿化（`is_masked` の DEFAULT 1、FR-010・FR-015）、代表画像がその実績の画像であること（複合の外部キー、FR-028）、画像の持ち主が 1 つ（`media` の CHECK）、指されている組織の削除（NO ACTION の外部キー、FR-006）、上書きの月数が 0 以上（`skill.months_override` の CHECK、FR-034）。

アプリケーションは、スキーマが拒む入力を保存の前にも確かめ、画面で項目ごとに知らせる。スキーマの制約は最後の守りとして残す。

## アプリケーションが守る決まり

スキーマに無く、Repository の実装かユースケースが守る決まり。

| 決まり | 要件 | 置き場 |
|---|---|---|
| `is_masked = 1` の職歴・実績は、`name_masked` が NULL の組織を指せない。指している組織の `name_masked` を空にできない | FR-001 | `src/shared/domain/organization.ts` の判定と、職歴・実績・組織の保存のユースケース。DB のトリガで止めるかは未決（plan.md の U2） |
| 秘匿化した実績の識別子は書き換えを拒む。秘匿化に切り替えたら新しい uid にする | FR-013 | `src/features/project/domain/` |
| 登録のときの識別子は uid（research.md の R6） | FR-013 | 同上 |
| 職歴・実績の保存は、開いたときの `updated_at` と一致するときだけ書く | FR-042 | Repository の実装（research.md の R7） |
| 組織名は入力した文字列で既存の組織を探し、無ければ作る | FR-002・FR-003 | `src/shared/server/organization-repository.ts` |
| 個人の組織は削除できない | FR-041 | `src/shared/domain/organization.ts` の定数 |
| 削除の前に子の行を消すか空にする | FR-006、Edge Cases | Repository の実装（research.md の R8） |
| 実績の関連 URL は 1 つ | FR-018 | 列が 1 つ（`project.url`） |
| 職歴の実績は、同じ組織で期間が重なる実績。職歴のスキルはそれらのスキルを合わせたもの | FR-017・FR-035 | `src/shared/domain/period.ts` の重なりの判定。端の扱いは未決（plan.md の U6 の残り） |
| 経験年数は、スキルをつないだ実績の期間をつなぎ、重なりを除いた長さ。上書きの月数があればそれを使う | FR-033・FR-034 | 同上。月を単位に数える（spec の FR-033） |

## 状態の切り替え

職歴と実績が持つ状態は `is_masked` の 2 つだけ。下書きの状態は無く、保存した時点で訪問者に出る（実績のページ。職歴は 005 の一覧）。

| 切り替え | 起きること |
|---|---|
| 登録 | `is_masked` を指定しなければ 1（DEFAULT）。実績の識別子は uid |
| 0 → 1（実績） | 識別子を新しい uid にする。古い識別子の URL は 404 になる。組織が `name_masked` を持たなければ保存しない |
| 1 → 0（実績） | 識別子は uid のまま。保存の後で書き換えられる |
| 0 ↔ 1（職歴） | 組織の制約のほかに起きることは無い |

キャッシュを持たないため、切り替えを保存した直後の要求から新しい状態で出る（FR-043、research.md の R12）。作った職務経歴書の中身は写しのため変わらない。

## domain の型

各機能の `domain/` に置く。行の型は Repository の実装の中だけに置き、ここへ詰め替える（research.md の R3）。

- `Organization`: id・名前・秘匿化した組織名（空あり）・更新日時
- `Career`: id・組織・肩書・期間・本文（空あり）・関連 URL（空あり）・秘匿化するか・更新日時
- `Project`: id・組織・種類・識別子・題・秘匿化した題・秘匿化するか・代表画像（空あり）・期間・本文（空あり）・関連 URL（空あり）・スキルの id の並び・更新日時
- `Skill`: id・名前・上書きの月数（空あり）
- `Education`: id・学校・学部（空あり）・期間・備考（空あり）
- `Period`（`src/shared/domain/period.ts`）: 始まりの日・終わりの日（空なら続いている）。日付は `YYYY-MM-DD` の文字列のまま持ち、時刻帯を持たない
- `ProjectKind`: `application`・`talk`・`event`・`other` の `as const` の配列から作る型

## 訪問者向けの DTO

訪問者に渡す形は [contracts/visitor-project.md](./contracts/visitor-project.md) が持つ。
