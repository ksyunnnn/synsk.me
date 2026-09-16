---
status: accepted
date: 2026-09-16
decision-makers: synsk
consulted: Claude
---

# コード規約を静的解析の設定そのものにする

## Context and Problem Statement

SWEBOK Guide V4.0a の 4 章は、コード規約を `Coding standards (e.g., standards for naming conventions, layout and indentation)` とし、ビルドで `validate coding standards via automated static analysis` とする。

AI が読む前提の書き方について、2026-09-15 に次のことを調べた（※は取得ツールの要約を経由したもの）。

- Cursor の Rules は `Copying entire style guides: Use a linter instead` とする ※
- Claude Code の Best practices は `Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens` とする

2026-09-15 に、コード規約は静的解析の設定そのものとし、文章で書き写さないと決めた。その中身（検査すること・土台にする設定・動かす場所）は、2026-09-16 の対話で決めた。

2026-09-16 に原文で確かめた事実は次のとおり。

- Next.js 16 では `next lint` が削除され、`next build` は lint を実行しない。`Use Biome or ESLint directly.`
- `eslint-config-next` 16.3.4 の中身（`node_modules/eslint-config-next/dist/index.js`）は、React・Rules of React・Next・import・jsx-a11y 6 規則・typescript-eslint である
- `server-only` は、client から import すると `there will be a build-time error` とする
- typescript-eslint は `Running typed linting on a project is generally as slow as type checking that same project.`、`We do not recommend TypeScript projects extend from plugin:@typescript-eslint/all.` とする
- blockscout/frontend は、ESLint 側で循環を見ると CI が 1 分 15 秒から 4 分 27 秒になったと、設定のコメントに記録している
- `npx eslint .` は 16.3 秒かかる（2026-09-16、`src` と `tests` の TypeScript 19 ファイルでの実測）

## Considered Options

* コード規約を文章で書く
* コード規約を静的解析の設定そのものにする

## Decision Outcome

**コード規約は静的解析の設定そのものとし、文章で書き写さない。** 検査するのは、ADR-0031 の設計原則 9 つから検査したいことを出し、機械的に判定できるものだけとする。

### 検査すること

| 検査すること | もとにした原則 |
|---|---|
| 型が通る | 3 |
| 依存の向き 5 つ、境目をまたぐ型の持ち込み（画面側が保存用の型を受け取らない、Cloudflare 固有の型が `server/` の外に出ない、外部サービスの型が境目の外に出ない） | 1、7、8、9 |
| 循環した依存、孤立したファイル | 9 |
| 使われていない export・ファイル | 9 |
| `any` と `as` での型の握りつぶし | 3 |
| 失敗しうる処理の結果を捨てていない | 4 |
| 操作できる要素に、キーボードと読み上げのための情報がある | 5 |
| 秘密の値がコードに書かれていない | 1 |
| データを取り出す処理が `server/` の外にない | 1 |

**検査しないもの**

| 項目 | 理由 |
|---|---|
| 外へ発信する処理と繰り返す処理に上限が渡されている（原則 2） | 機械的に判定できない。デザインパターンとレビューで見る |
| 画面が、データなし・読み込み中・エラーの各状態を持つ（原則 4） | 同上 |
| テストが通る | ADR-0019 と constitution の Test Layering が持つ |
| 表示速度、配信するファイルの大きさ（原則 6） | 変更のたびに測るかを、この決定とは別に決める |

### 土台と足す規則

**土台**: `eslint-config-next` の `/core-web-vitals` と `/typescript`。Next.js 公式が配り、保守されている（16.3.5、2026-09-11）。Rules of React の 16 規則（`eslint-plugin-react-hooks@7`）が、これを入れた時点で効く。

**足すもの**

| 足すもの | 何のため |
|---|---|
| jsx-a11y の推奨一式 | `eslint-config-next` は 6 規則だけなので広げる |
| eslint-plugin-boundaries | 依存の向き、境目をまたぐ型の持ち込み |
| typescript-eslint の型を使う規則を少数 | 失敗の握りつぶし、`any`、`as` |
| dependency-cruiser | 循環と孤立したファイル |
| knip | 使われていない export・ファイル |
| secretlint | 秘密の値の混入 |

**入れないもの**

| 入れないもの | 理由 |
|---|---|
| `eslint-config-airbnb`、`@vercel/style-guide` | 保守が止まっている（2021-12-25 の公開が最後、リポジトリは archive） |
| typescript-eslint の `all` と `strict` | 公式が `all` を勧めず、`strict` は版の安定を保証しないとしている |
| madge | 循環の検出が dependency-cruiser と重なる |
| Biome、oxlint | lint を Biome か oxlint に替えるかは、この決定とは別に決める |

### 境目の書き方

禁止を少数にし、既定は許可にする。値の import だけを止め、型の import は通す。全ファイルを受け止める設定を置く（resolver が効かないと import 先が「不明」になり、規則が静かに素通りするため）。blockscout/frontend の設定（禁止 2 本、`default: 'allow'`）に倣う。許可を並べる方式や、既定を禁止にする方式は、除外と許可の一覧が伸び続ける。

### 動かす場所

**書きながら（エディタ）** — 表示するだけ。無視できる

- 依存の向き／境目をまたぐ型、`any` と `as`、アクセシビリティ

**PR の CI** — 最後の関門。ここは必ず持つ

- 型検査、依存の向き／境目をまたぐ型、`any` と `as`、アクセシビリティ、失敗の握りつぶし、使われていない export、秘密の値、ビルド（`server-only` の違反はビルドで落ちる）

**CI の別の仕事（並行）**

- 循環と孤立したファイル。ESLint 側で循環を見ると重い（blockscout/frontend の記録は Context にある）

**手元の git の hook**

- 置く方向とする。入れる時期は、lint を Biome か oxlint に替えるかの判断の結果で決める
- 手元に置く目的は、気づくのを早くすること。CI の代わりにはしない。`--no-verify` で飛ばせること、手元と CI で設定がずれること、別の経路の変更が通らないことがあるため

### この決定に含めないもの

- Claude Code の hook。公式は用途として lint と書式を挙げている（`Format code, send notifications, validate commands, and enforce project rules.`）が、2026-09-16 の時点で設定がなく、効くのは Claude Code が書いたときだけ
- GitHub の push protection（秘密の値の push を止めるリポジトリの設定。既定は無効）

### Consequences

* Bad, because 外へ発信する処理と繰り返す処理の上限（原則 2）と、画面の各状態（原則 4）は機械的に判定できず、静的解析では検査しない。デザインパターンとレビューで見る
* Bad, because typescript-eslint の型を使う規則は、型検査と同じくらい遅い（`Running typed linting on a project is generally as slow as type checking that same project.`）

### Confirmation

判定は、上の「動かす場所」のとおり PR の CI で検査を実行して行う。2026-09-16 の時点で、eslint-plugin-boundaries・dependency-cruiser・knip・secretlint は `package.json` に入っておらず、CI でも実行していない。

## Pros and Cons of the Options

### コード規約を文章で書く

* Bad, because Cursor の Rules は、スタイルガイドを写す代わりに `Use a linter instead` とする ※要約
* Bad, because Claude Code の Best practices は、CLAUDE.md の指示を advisory、hook を deterministic とする

### コード規約を静的解析の設定そのものにする — 採用

* Good, because SWEBOK Guide V4.0a が、コード規約を `validate coding standards via automated static analysis` とする
* Bad, because 機械的に判定できないもの（上限、画面の各状態）は検査できない

## More Information

2026-09-16 に確かめた版

- `eslint-config-next` 16.3.5（2026-09-11）
- eslint-plugin-boundaries 7.2.0、dependency-cruiser 18.3.1、knip 6.35.1、secretlint 13.0.5

2026-09-16 に原文で確かめた実例: blockscout/frontend、schedule-x/schedule-x、MH4GF/mysite、newjersey/navigator.business.nj.gov、vercel/next.js、vitejs/vite

出典

- [Claude Code: Best practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code: hooks](https://code.claude.com/docs/en/hooks-guide.md)
- [Cursor: Rules](https://cursor.com/docs/context/rules)

関連する決定の記録

- [ADR-0019](./0019-testing-strategy.md)
- [ADR-0031: 設計原則を ISO/IEC 25010 の品質特性ごとに 1 つ置く](./0031-design-principles-by-iso25010.md)
