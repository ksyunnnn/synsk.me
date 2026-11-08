# Contract: 職務経歴書のページ（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /resume/{slug}`、限定公開用で訪問者に見せる状態、期限の前か期限が無い | 200。下の DTO の値だけで描画する。`Cache-Control: no-store, must-revalidate`・`X-Robots-Tag: noindex`・`Referrer-Policy: no-referrer` |
| `GET /resume/{slug}`、公開用で訪問者に見せる状態 | 200。下の DTO の値だけで描画する（tasks.md の T069） |
| 上の条件に合わない（下書き・期限切れ・識別子が無い・出し直す前の識別子） | 404。`src/proxy.ts` が描画の前に `/resume/{slug}/missing` へ rewrite する。上と同じ 3 つのヘッダ |
| D1 から読めない | proxy は判定せずに通し、ページが 500 の画面を返す。上と同じ 3 つのヘッダ |

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。ヘッダは `/resume/{slug}` とその下の経路の形で付け、D1 を読む前に決める（research.md の R7）。

## DTO

Repository の実装が R6（research.md）の条件で読み、写した行を詰める。画面・`<title>`・OGP・RSC の応答は、この形の値だけを使う。PDF は訪問者のブラウザが同じページを印刷して作る（research.md の R11）。プロフィールはコードの定数と環境変数から足す（research.md の R10）。

### 職務経歴書

| 項目 | 元 |
|---|---|
| `audience` | `resume.audience` |
| `profile` | 氏名・自己紹介・メールアドレス（空あり）。項目は research.md の R10 |
| `careers` | 写した職歴の並び（始まりの日の新しい順） |
| `projects` | 写した実績の並び（同上） |
| `educations` | 写した学歴の並び（同上） |
| `skills` | 名前と経験年数の並び（research.md の R12。経験年数は 001 の FR-033 の数え方） |

`resume.title`・`resume.slug`・期限・状態・`*_id` は渡さない。題を訪問者に出すかは spec が決めない（plan.md の U10）。

### 写した職歴（秘匿化しない、または限定公開用）

| 項目 | 元の列 |
|---|---|
| `isMasked` | `false` |
| `organizationName` | `resume_career.organization_name` |
| `role` | `resume_career.role` |
| `period` | `resume_career.started_on`・`ended_on` |
| `body` | `resume_career.description`（空あり）。表示は plan.md の U4 |
| `url` | `resume_career.url`（空あり） |

### 写した実績（秘匿化しない、または限定公開用）

| 項目 | 元の列 |
|---|---|
| `isMasked` | `false` |
| `organizationName` | `resume_project.organization_name` |
| `kind` | `resume_project.kind` |
| `title` | `resume_project.title` |
| `period` | `resume_project.started_on`・`ended_on` |
| `skills` | `resume_project_skill.skill_name` の並び |
| `body` | `resume_project.description`（空あり） |
| `url` | `resume_project.url`（空あり） |

### 公開用で秘匿化した職歴・実績（`isMasked: true`）

上の表から `body` と `url` を除いた形。SQL も `description`・`url` を読まない（FR-017・FR-018）。伏せた見た目は、本文の場所に「非公開」と出す形（spec の FR-017、plan.md の U5）。どの行が秘匿化した行かは `resume_career.is_masked`・`resume_project.is_masked` で見分ける。

限定公開用の DTO は、すべての写した職歴・実績を `isMasked: false` の形で返す（FR-010）。

### 写した学歴

| 項目 | 元の列 |
|---|---|
| `school` | `resume_education.school` |
| `department` | `resume_education.department`（空あり） |
| `period` | `resume_education.started_on`・`ended_on` |
| `remarks` | `resume_education.remarks`（空あり） |

## 検査

- 結合: 限定公開用の 4 つの状態（下書き・期限切れ・識別子が合わない・出し直す前の識別子）で、ページの応答が 404 で、写した値を含まない（SC-003、FR-040）
- 結合: 限定公開用の 200 の応答に、秘匿化した写し元の実際の題・組織名・本文が出る（FR-010、User Story 2 の 1）
- 結合: 限定公開用の応答のすべてが、`no-store`・`noindex`・`no-referrer` を持つ（SC-005）
- 結合: 期限を過ぎた限定公開用の期限を延ばすと、同じ URL が 200 になる（SC-004）
- 結合: 公開用のページの HTML と RSC の応答に、秘匿化した写し元の実際の組織名・題・本文・画像・関連 URL が 0 件（SC-002）
- 単体: `src/proxy.ts` が条件に合わない要求を `/resume/{slug}/missing` へ rewrite し、`/resume/{slug}` とその下の経路にヘッダを付ける
- workerd: 訪問者向けの取り出しが、公開用で秘匿化した行の `description`・`url` を返さない
