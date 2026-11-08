# Contract: 職務経歴書の管理画面と書き込みの操作

## 共通

001 の [contracts/dash.md](../../001-career-and-project/contracts/dash.md) の「共通」に従う（`src/proxy.ts` の 403 と `no-store`、ページと Server Action の先頭でのオーナーの確認、`<form action={Server Action}>`、失敗の結果は項目ごとの理由と送られた値、無い id の 404）。結果の型は `src/shared/domain/action-result.ts` の `ActionResult` を使う。

002 で足すこと:

- 職務経歴書の中の書き込みはすべて、開いたときの `resume.updated_at` を隠しフィールドで送る。一致しなければ何も書かず、`conflict` の結果で送られた値を返す（FR-038、research.md の R8）
- 写した行の画面（`/dash/resumes/{id}/<種類>/{rowId}`）は、行が無いか、その職務経歴書に属さなければ `src/proxy.ts` が `/dash/resumes/{id}/<種類>/{rowId}/missing` へ rewrite する（404）

## 画面

| 経路 | 中身 | 要件 |
|---|---|---|
| `/dash/resumes` | 職務経歴書の一覧。題・限定公開用か公開用か・状態・期限 | FR-001、Edge Cases（期限切れも読める） |
| `/dash/resumes/new` | 作成。題、限定公開用か公開用か（既定は限定公開用）、職歴・実績・学歴のチェックボックス（すべて選んだ状態で始まる。公開用を選んだときは、サイトに載せない職歴・実績を出さない）、限定公開用の期限 | FR-003・FR-005・FR-013・SC-006 |
| `/dash/resumes/{id}` | 設定（限定公開用の URL と出し直し・題・状態・期限・公開用の識別子）と、写した職歴・実績・学歴・スキルの一覧。各行の編集へのリンクと、訪問者に見せたときの見た目へのリンク | FR-021・FR-013・FR-014・FR-039・FR-040 |
| `/dash/resumes/{id}/careers/{rowId}` | 写した職歴の編集（組織名・肩書・期間・本文・関連 URL） | FR-031・FR-032 |
| `/dash/resumes/{id}/projects/{rowId}` | 写した実績の編集（組織名・種類・題・期間・本文・関連 URL・スキルの名前） | FR-031・FR-032 |
| `/dash/resumes/{id}/educations/{rowId}` | 写した学歴の編集（学校・学部・期間・備考） | FR-031・FR-032 |
| `/dash/resumes/{id}/skills` | 写した経験年数の上書きの編集（スキルごとに年と月、または空） | FR-028・FR-031 |
| `/dash/resumes/{id}/preview` | 訪問者に見せたときの見た目。訪問者向けと同じ DTO と部品で描く。状態・期限に関わらず出す | REQUIREMENTS.md の FR-13、Edge Cases |
| `/dash/resumes/{id}/delete` | 削除の確認 | FR-033、REQUIREMENTS.md の FR-11 |

秘匿化するかどうかの入力は、写した職歴・実績の編集の画面に出さない（FR-031）。限定公開用か公開用かは、作成の画面にだけ出す（FR-004）。限定公開用の識別子は読み取りだけで出す（FR-037）。

限定公開用の URL（`/resume/{slug}`）は、作成に成功した応答と設定の画面で示す（FR-040、research.md の R5）。

## Server Action

| 名前 | 入力 | 成功 | 失敗の理由 |
|---|---|---|---|
| `createResume` | 題・限定公開用か公開用か・職歴の id の並び・実績の id の並び・学歴の id の並び・期限（限定公開用、空あり） | 限定公開用は同じ画面に URL と設定の画面へのリンクを返す。公開用は設定の画面へ 303 | オーナーでない／項目の不備／2 つ目の公開用／選んだ行が無い／公開用で、秘匿化した組織名の無い組織を指す秘匿化した職歴・実績を選んだ／公開用で、サイトに載せない職歴・実績を選んだ |
| `editResumeSettings` | id・開いたときの更新日時・題・識別子（公開用だけ）・期限（限定公開用だけ、空あり） | 同じ画面へ 303 | オーナーでない／項目の不備／識別子の重複／限定公開用の識別子の書き換え／先に書き換えられていた |
| `changeResumeStatus` | id・開いたときの更新日時・下書きか訪問者に見せるか | 同上 | オーナーでない／先に書き換えられていた |
| `regenerateResumeUrl` | id・開いたときの更新日時 | 識別子を新しい uid に書き換え、同じ画面へ 303 | オーナーでない／先に書き換えられていた／公開用か無い id |
| `editResumeCareer`・`editResumeProject`・`editResumeEducation` | id・写した行の id・開いたときの更新日時・上の「画面」の列 | 設定の画面へ 303 | オーナーでない／項目の不備／行が無い／先に書き換えられていた |
| `editResumeSkillOverrides` | id・開いたときの更新日時・スキルの名前ごとの年と月 | 同上 | オーナーでない／項目の不備／先に書き換えられていた |
| `deleteResume` | id | 一覧へ 303 | オーナーでない／無い |

## 検査

- 結合: JWT のない `/dash/resumes/*` の GET が 403 で、`no-store` を持つ
- 結合: JWT のない各 Server Action の呼び出しが 403 の結果を返し、D1 の行が変わらない（FR-033、constitution I）
- E2E: オーナーとして、限定公開用を作り、写した行を直し、状態を切り替え、削除できる。キーボードだけで操作できる（constitution V）
- E2E: 2 つのタブで同じ職務経歴書を開き、後から保存した側が止まり、入力が残る（FR-038）
