# Contract: 管理画面と書き込みの操作

## 共通

- `/dash` と `/dash/*` の GET は、`src/proxy.ts` が作り手を確かめ、作り手でなければ `/dash/forbidden` へ rewrite する（403）。応答に `Cache-Control: no-store, must-revalidate` を付ける（NFR-09）
- ページは描画の前に、Server Action は書き込みの前に、`src/shared/server/author.ts` で作り手を確かめる（ADR-0036）。作り手でなければ何も書かず、403 の結果を返す
- 書き込みはすべて `<form action={Server Action}>` で送り、JavaScript なしでも保存できる
- 失敗の結果は、項目ごとの理由と、送られた入力の値を返す。画面は入力を消さずに理由を示す
- 編集の画面を持つ行は id で開く（`/dash/<コレクション>/{id}`）。id が無ければ `src/proxy.ts` が `/dash/<コレクション>/{id}/missing` へ rewrite する（404）

## 画面

| 経路 | 中身 | 要件 |
|---|---|---|
| `/dash` | 職歴・実績・学歴・スキル・組織への入口 | — |
| `/dash/projects`、`/dash/projects/new`、`/dash/projects/{id}`、`/dash/projects/{id}/delete` | 実績の一覧・登録・編集・削除の確認 | FR-011〜FR-018、FR-032、FR-042 |
| `/dash/careers`、`/dash/careers/new`、`/dash/careers/{id}`、`/dash/careers/{id}/delete` | 職歴の一覧・登録・編集・削除の確認 | FR-007〜FR-010、FR-042 |
| `/dash/educations`、`/dash/educations/new`、`/dash/educations/{id}`、`/dash/educations/{id}/delete` | 学歴 | FR-036 |
| `/dash/skills`、`/dash/skills/new`、`/dash/skills/{id}`、`/dash/skills/{id}/delete` | スキルと経験年数（求めた値と上書き） | FR-031・FR-033・FR-034 |
| `/dash/organizations`、`/dash/organizations/{id}`、`/dash/organizations/{id}/delete` | 組織名・秘匿化した組織名の編集と削除。登録は職歴・実績の入力の中で行う | FR-001・FR-004・FR-006 |

削除の確認を別のページにするのは、ダイアログの部品（headless のライブラリ、plan.md の U3）に頼らず、JavaScript なしでも確かめてから消せるようにするため。

## Server Action

| 名前 | 入力 | 成功 | 失敗の理由 |
|---|---|---|---|
| `registerProject` | 組織名・種類・題・秘匿化した題・秘匿化するか・期間・本文・関連 URL・スキルの id | 編集の画面へ 303 | 作り手でない／項目の不備／秘匿化した組織名の無い組織で秘匿化 |
| `editProject` | 上に加えて id・識別子・開いたときの更新日時 | 同じ画面へ 303 | 上に加えて、識別子の重複／秘匿化した実績の識別子の書き換え／先に書き換えられていた |
| `deleteProject` | id | 一覧へ 303 | 作り手でない／無い |
| `registerCareer`・`editCareer`・`deleteCareer` | 組織名・肩書・期間・本文・関連 URL・秘匿化するか（編集は id と開いたときの更新日時） | 同上 | 同上（識別子を除く） |
| `registerEducation`・`editEducation`・`deleteEducation` | 学校・学部・期間・備考 | 同上 | 作り手でない／項目の不備 |
| `registerSkill`・`editSkill`・`deleteSkill` | 名前・上書きの年と月 | 同上 | 作り手でない／大文字と小文字だけ違う名前の重複 |
| `editOrganization`・`deleteOrganization` | 組織名・秘匿化した組織名 | 同上 | 作り手でない／名前の重複／秘匿化した職歴・実績が指すのに秘匿化した組織名を空にした／職歴・実績が指している／個人の組織の削除 |

画像の追加と代表画像の選択の操作は、plan.md の U4・U5 が解けてから足す。

## 検査

- 結合: JWT のない `/dash/*` の GET が 403 で、`no-store` を持つ
- 結合: JWT のない各 Server Action の呼び出しが 403 の結果を返し、D1 の行が変わらない（constitution I）
- E2E: 作り手として、実績と職歴を登録・編集・削除できる。キーボードだけで操作できる（constitution V）
