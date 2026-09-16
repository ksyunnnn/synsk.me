---
status: accepted
date: 2026-09-16
decision-makers: synsk
consulted: Claude
---

# デザインパターンの基本を 9 つ置き、中身が合うものだけ一般名で呼ぶ

## Context and Problem Statement

デザインパターンは、コードの形の定番（GoF などが言うもの）を指す。SWEBOK Guide V4.0a の 3 章は、GoF を引用して `a common solution to a common problem in a given context` と定義する。デザインガイドラインの Patterns（UI の定番）とは別のものである。

2026-09-15 から 2026-09-16 の対話で、基本のパターンを 9 つ選び、それぞれに名前と一言と、もとにした設計原則（ADR-0031 の番号）を付けた。2026-09-16 に一般名を調べる前は、Dependency Injection を「依存を作るときに渡す」、Anti-Corruption Layer を「外部データの詰め替え」と呼んでいた。

2026-09-16 に各パターンの一般名を調べ、次のことが分かった。

- Use Case は層の名前で、関数の単位は定めていない
- headless UI には、提唱者による定義がない
- Result 型は成功か失敗の二択で、一部だけ取れた状態を表さない

## Considered Options

* 一般名をそのまま使う
* synsk.me の名前を使う
* 一般名と synsk.me の名前を併記する

## Decision Outcome

**基本のデザインパターンを 9 つ置く。名前は一般名を調べ、中身が合うものだけ一般名にする。**

9 つのうち、DTO を採る理由は [ADR-0028](./0028-dto-for-screens.md)、Repository は [ADR-0029](./0029-visibility-check-at-retrieval.md)、組み立て用の関数は [ADR-0030](./0030-composition-function-per-feature.md) が持つ。

### 採るパターン

残る 6 つは次のとおり。どれも、もとにした設計原則（ADR-0031 の番号）と、同じ形を示す出どころを持つ。

| 名前 | 一言 | もとにした原則 | 出どころ |
|---|---|---|---|
| Dependency Injection | 使うものを内側で作らず、外から受け取る | 9 | Chromium の design principles（`Dependencies should be injected during construction.`）、Fowler「Inversion of Control Containers and the Dependency Injection pattern」（2004-01-23） |
| 読む → 計算 → 書く | 読み書きを両端に寄せ、間を計算だけにする | 9 | Mark Seemann「Recawr Sandwich」（2025-01-13） |
| ユースケースを単位にする | 「やりたいこと 1 つ」を関数の単位にする | 9 | GitLab の Software design guides（`Design software around use-cases, not entities`）、ADOP |
| Anti-Corruption Layer | 外部サービスの形は、境目で synsk.me の形に変える | 7 | Eric Evans『Domain-Driven Design』。Microsoft Learn の同名のページ（ms.date 2026-05-28）が `The anti-corruption layer contains all the logic necessary to translate between the two systems.` と解説 |
| 失敗の表し方 | 失敗しても、取れた部分と欠けたことを返す | 4 | Go Proverbs（`Errors are values.`）、rust-analyzer の Architecture Invariant（`parsing never fails`）、Zed の `.rules`（`Never silently discard errors`） |
| 見た目と操作を分ける | 操作・フォーカス・状態は headless のライブラリに任せ、見た目をかぶせる | 5、9 | [ADR-0026](./0026-code-structure-adop.md) のディレクトリの形（headless のライブラリ）。Base UI（`Base UI components are unstyled, don't bundle CSS, and don't prescribe a styling solution.`）、shadcn/ui |

### 名前

| 扱い | パターン | 理由 |
|---|---|---|
| 一般名をそのまま使う | Dependency Injection、Anti-Corruption Layer | 一般名と中身が合う |
| 一般名をそのまま使う（違いを添える） | Repository | 見せてよいかを確かめる役割は、Repository（Fowler、Patterns of Enterprise Application Architecture）の定義になく、synsk.me が足した |
| synsk.me の名前を使う | DTO | Data Transfer Object の目的は、呼び出しの回数を減らすこと |
| synsk.me の名前を使う | 組み立て用の関数 | Composition Root はアプリケーション全体に 1 つ |
| synsk.me の名前を使う | ユースケースを単位にする | Use Case は層の名前で、関数の単位は定めていない |
| 併記する | 読む → 計算 → 書く（Recawr Sandwich、広くは Functional Core, Imperative Shell）、見た目と操作を分ける（headless UI） | — |
| synsk.me の名前を使う（一般名が見つからない） | 失敗の表し方 | Result 型は成功か失敗の二択で、一部だけ取れた状態を表さない |

### パターンにしないもの

原則から導けて、コード規約（静的解析の設定）で検査できるものは、パターンに書かない。

| 候補 | 出どころ |
|---|---|
| 何でも屋を作らない | Chromium `god-object anti-pattern`、GitLab `Taming Omniscient classes` |
| 上限を設ける | TigerBeetle `Put a limit on everything` |
| 状態を持たない | rust-analyzer `the server is stateless, a-la HTTP.` |
| 共通の言葉で名前を付ける | GitLab `Use ubiquitous language instead of CRUD terminology`、DDD Reference |

### Confirmation

Anti-Corruption Layer の「外部サービスの型が境目の外に出ない」と、失敗の表し方の「失敗しうる処理の結果を捨てていない」は、静的解析で検査する（[ADR-0033](./0033-code-conventions-as-static-analysis.md)）。Dependency Injection、読む → 計算 → 書く、ユースケースを単位にするに沿っているかを判定する手段は定めていない。

2026-09-16 に、一時ディレクトリに最小限の型宣言を置き、9 つのパターンに沿うコードと反するコードを写して、その日のこのリポジトリの設定で確かめた。

- 「見た目と操作を分ける」に反するコードは、eslint で `jsx-a11y/click-events-have-key-events` と `jsx-a11y/no-static-element-interactions` の error になった
- 残る 5 つに反するコードは、`tsc --noEmit`（`strict: true`）でも eslint でも error にならなかった

## More Information

出典

- [Chromium: //chrome/browser design principles](https://chromium.googlesource.com/chromium/src/+/main/docs/chrome_browser_design_principles.md)
- [GitLab: Software design guides](https://gitlab.com/gitlab-org/gitlab/-/blob/master/doc/development/software_design.md)
- [Go Proverbs](https://go-proverbs.github.io/)
- [rust-analyzer: Architecture](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/architecture.md)
- [Zed: .rules](https://github.com/zed-industries/zed/blob/main/.rules)
- [TigerBeetle: TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md)

関連する決定の記録

- [ADR-0031: 設計原則を ISO/IEC 25010 の品質特性ごとに 1 つ置く](./0031-design-principles-by-iso25010.md)
- [ADR-0033: コード規約を静的解析の設定そのものにする](./0033-code-conventions-as-static-analysis.md)
