# Contract: 実績の個別のページ（訪問者）

## 経路

| 要求 | 応答 |
|---|---|
| `GET /projects/{slug}`、サイトに載せる実績がある | 200。下の DTO の値だけで描画する |
| `GET /projects/{slug}`、実績が無い（サイトに載せない実績と、秘匿化に切り替えて変わった古い識別子と、秘匿化した組織名の無い組織を指す秘匿化した実績を含む） | 404。`src/proxy.ts` が描画の前に `/projects/{slug}/missing` へ rewrite する |
| `GET /projects/{slug}`、D1 から読めない | proxy は判定せずに通し、ページが 500 の画面を返す |

キャッシュの指定（`'use cache'`・`revalidate`・`dynamic`）を持たない。

## DTO

Repository の実装は `status` が `published` の行だけを読み、`is_masked` を見て、出してよい列だけを SELECT して詰める。サイトに載せない実績の DTO は作らない（FR-045）。画面・`<title>`・OGP・RSC の応答は、この形の値だけを使う。

### 秘匿化しない実績（`isMasked: false`）

| 項目 | 元の列 |
|---|---|
| `isMasked` | `false` |
| `slug` | `project.slug` |
| `kind` | `project.kind` |
| `title` | `project.title` |
| `organizationName` | `organization.name` |
| `period` | `project.started_on`・`project.ended_on` |
| `skills` | `project_skill` がつなぐ `skill.name` の並び |
| `body` | `project.description`（空あり）。表示は本文の書式が決まってから（plan.md の U4） |
| `url` | `project.url`（空あり） |
| `cardImage` | `project.card_media_id` の画像（空あり）。配る経路は plan.md の U5 |

### 秘匿化した実績（`isMasked: true`）

| 項目 | 元の列 |
|---|---|
| `isMasked` | `true` |
| `slug` | `project.slug`（uid） |
| `kind` | `project.kind` |
| `title` | `project.title_masked` |
| `organizationName` | `organization.name_masked` |
| `period` | `project.started_on`・`project.ended_on` |
| `skills` | `project_skill` がつなぐ `skill.name` の並び |

本文が空かどうかも FR-026 が挙げる値に無いため渡さない。伏せた見た目の形は plan.md の U7。

秘匿化した実績の DTO は `body`・`url`・`cardImage` を持たない（FR-021・FR-022・FR-026・FR-030）。SQL も `project.title`・`organization.name`・`project.description`・`project.url`・`project.card_media_id` を読まない。

## 検査

- 結合: 秘匿化した実績のページの HTML と RSC の応答に、実際の題・実際の組織名・本文の中身・関連 URL・画像の URL が含まれない（SC-001）
- 結合: 秘匿化しない実績のページに、実際の題・組織名・本文が含まれる（User Story 1 の 1、User Story 2 の 4）
- 結合: サイトに載せない実績のページは HTML と RSC で 404 で、その実績の値が応答に含まれない。載せないに切り替えた直後の要求から 404（FR-014・FR-043・FR-045・SC-006、tests/integration/career-and-project-status.test.ts）
- 単体: `src/proxy.ts` が無い識別子を `/projects/{slug}/missing` へ rewrite する
- workerd: 訪問者向けの取り出しが、秘匿化した実績で隠す列を返さない。サイトに載せない実績を返さない
