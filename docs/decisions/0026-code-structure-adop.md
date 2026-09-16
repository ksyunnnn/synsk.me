---
status: accepted
date: 2026-09-15
decision-makers: synsk
consulted: Claude
---

# コードの構成に ADOP を使う

## Context and Problem Statement

synsk.me のコードをどのディレクトリに置き、どの向きに依存させるかを、2026-09-13 から 2026-09-14 の対話で決めた。2026-09-09 の時点で、synsk.me に層の分け方と依存の向きを定めた accepted の決定の記録はなかった。

2026-09-13 にディレクトリの形を合意したときに確かめていた事実は次のとおり。

- `wrangler.jsonc` の Worker は 1 つで、`main` が `vinext/server/fetch-handler`。画像の最適化・キャッシュ・D1・R2 の binding もこの Worker にある
- vinext の公式サイト（`cloudflare/vinext` の `apps/web/worker/index.ts`）が、`worker/index.ts` を置く形で Cron を動かしている（`vinext@1.0.0-beta.9`）。vinext の `dist/server/fetch-handler.js` のコメントに `Or import and delegate to it from a custom worker` とある
- Workers のアプリ 3 件（cloudflare/vibesdk、cloudflare/agentic-inbox、cloudflare/cloudflare-os）が、トップか 1 段目で実行環境を分けている
- Netflix/metaflow-ui は `src/components/` を共有に置き、`src/pages/Run/components/` をページ内に置く（最新コミット 2026-01-06）
- Base UI: `Base UI components are unstyled, don't bundle CSS, and don't prescribe a styling solution.`（1.8.0、2026-09-04）。Animation ガイド: `Each component provides a number of data attributes to target its states, as well as a few attributes specifically for animation.`（最終更新 2026-06-15）
- shadcn/ui: `The topmost layer, i.e., the one closest to your design system, is not coupled with the implementation of the library.`（CLI 4.21.0、2026-09-04）
- Kent Beck: `It's about the cost of speculative structure—structure you build ahead of the feature that needs it.`（2026-06-25）

Next.js のドキュメントが構成について明言しているのは、`Next.js is unopinionated about how you organize and colocate your project files.` と `The simplest takeaway is to choose a strategy that works for you and your team and be consistent across the project.` の 2 点である。`Split project files by feature or route` の分ける先は `app/` の中のルートセグメントであり（`splits more specific application code into the route segments that use them`）、`app/` の外に `features/` を置く根拠にはならない。`Add page to expose a route, layout for shared UI such as header, nav, or footer` は、`page` がルートを公開し、`layout` が共有の UI を持つと言うだけで、`page` を組み立ての層と定めた文ではない。

アーキテクチャの型は、Hexagonal・Clean・Recawr Sandwich・Vertical Slice を候補に検討した。Clean を選ぶ案が出たが保留し、DDD との関係を先に確かめた。

- DDD Reference（© 2015）は、層について目的だけを定め、形は他の型に任せている: `The key goal here is isolation. Related patterns, such as “Hexagonal Architecture” may serve as well or better`
- DDD Reference（© 2015）の第 II 部に Layered Architecture の項がある: `Isolate the expression of the domain model and the business logic, and eliminate any dependency on infrastructure, user interface, or even application logic that is not business logic. Partition a complex program into layers.`（訳: ドメインモデルとビジネスロジックの表現を隔離し、インフラ・ユーザーインターフェース、さらにビジネスロジックでないアプリケーションのロジックへの依存をすべて取り除く。複雑なプログラムを層に分ける）
- Clean Architecture: `source code dependencies can only point inwards`（Martin、2012-08-13）

2026-09-14 に、DDD と Clean Architecture を、採用の決定ではなく検討の前提として置いた。

nrs（成瀬 允宣）の記述のうち、判断に使ったものは次の 3 つ。

- DDD とアーキテクチャ: `ドメイン駆動設計においてアーキテクチャはドメインレイヤーを隔離する手段にすぎないので、他のアーキテクチャと組み合わせることが可能です。`（ADOP、2020-12-13）
- Clean の Entities と DDD のエンティティ: `クリーンアーキテクチャにおけるエンティティはドメイン駆動設計のモデルのことで、つまりエンティティ以外のモデリング要素も含んだすべてを指しているのです。`（2019-03-08）
- Clean のユースケースと DDD: `ドメイン駆動設計ではアプリケーションサービスがこの Interactor に相当します。`（2018-09-09）

ADOP（Application Domain Others Pattern）の記事は、公開 2020-12-13、更新 2021-04-23 である。2026-09-14 の時点で、これより新しい改訂は見つかっていない。記事は ADOP を `ヘキサゴナルアーキテクチャの実装パターンとして考えられます。` とし、同じ節でオニオンアーキテクチャ・クリーンアーキテクチャ・独立したコアレイヤーパターンとも `同様です` と書いている。記事が挙げる ADOP の動機は次のとおり。

- `既存のアーキテクチャが設計に関心を寄せたばかりの入門者にとって、敷居の高いものであることに気づいたからです。`
- `ディレクトリ構造やコーディングに関して明確な指針があるので、受取り手の解釈によるブレがないこと。`
- `制約を守るために多大なる労力を求められるようであれば、いつしか制約が守られなくなってしまいます。`

作り手は 2026-09-14 に「私はそもそもクリーンアーキテクチャもDDDも詳しくないです」と述べていた。

## Decision Drivers

* ドメインを UI とインフラから隔離する（DDD）
* 依存を内向きだけに固定する（Clean Architecture）
* 作り手が 2026-09-14 に述べた理由: 「本家はかなりハードルが高く感じたことが大きいです。」

## Considered Options

* nrs の ADOP をもとにした形（版 A）
* Martin の記事と DDD Reference に忠実な形（版 B）

## Decision Outcome

**層の分け方と依存のルールは、nrs の ADOP に従う。3 つの層は `features/<名前>/` の中に置く。**

選ぶ直前に確かめていた事実は、ADOP の動機と、作り手が「私はそもそもクリーンアーキテクチャもDDDも詳しくないです」と述べていたことである。作り手は理由を「本家はかなりハードルが高く感じたことが大きいです。」と述べた。

ADOP は、nrs が Hexagonal・Onion・Clean と同じ考え方の実装の型として示したもので、DDD とも組み合わせられると本人が書いている。DDD と Clean Architecture を前提に置いた中で、実装の型として ADOP を選んだ。

### ADOP のルール

1. `オブジェクトが３つのレイヤーのうち、どれにあたるかを考え、配置すること`
2. `上位レイヤーのオブジェクトが下位レイヤーのオブジェクトを取り扱うときには汎化すること`

「汎化」は、インタフェースを介して扱うことを指す。層の定義と置き場の問い方は、ADOP の記事が持つ。

### ディレクトリの形

```
worker/index.ts              定期実行の入口を持つ場合だけ置く
src/
├── app/                     Others（UI）。page.tsx・layout.tsx。組み立て用の関数を呼ぶ（ADR-0030）
├── features/
│   └── <名前>/
│       ├── domain/          Domain。エンティティ・値オブジェクト・リポジトリのインタフェース
│       ├── application/     Application。ユースケース
│       ├── components/      Others（UI）
│       └── server/          Others（インフラ）。リポジトリの実装と組み立て用の関数。先頭で import 'server-only'
└── shared/                  複数の機能で使うもの
    ├── components/          headless の上に、見た目と動きをかぶせた部品
    ├── domain/
    ├── server/
    └── types/               サーバとクライアントで共有する型
```

- Next.js と依存が分かれるアプリは置かない。すべて同じ Next.js の中に置く
- 定期実行の入口を持つ場合は、ルートに `worker/index.ts` を置く
- サーバでしか動かないコードはフォルダで分ける
- 機能の下に技術を置く。複数の機能で使うものはトップの `shared/` に 1 か所で置く
- 操作・フォーカス・状態は headless のライブラリ（npm）に任せ、見た目と動きは `shared/components/` が持つ
- 組み立ては、機能ごとの組み立て用の関数（`server/`）が行い、`page.tsx` と `layout.tsx` はそれを呼ぶ（[ADR-0030](./0030-composition-function-per-feature.md)）
- デザインの値は、リポジトリの `design/` に置く。`docs/README.md` は `design/` を「デザインの探索と、採用した案」の置き場としている

ADOP の本文から来ているものは次のとおり。

- 層を Domain・Application・Others の 3 つに分け、層ごとにディレクトリを分ける
- リポジトリのインタフェースを Domain に置く。記事の既定であり、記事は `ただし、これはそれらをアプリケーションレイヤーに配置する可能性を奪うものではありません。` とも書いている
- Others を技術ごとに分ける
- UI の側が Application を呼ぶ。記事の例では、コントローラのアクションが `BackLogApplicationService` を受け取り、`BackLogApplicationService はアプリケーションレイヤーのコードです。` と説明している
- 保存のときに、データベース用の形へ移し替える: `UserStoryDataModel といったオブジェクトに移し替えを行い、ドメインレイヤーが特定のインフラストラクチャのコードに侵食されないようにすることを推奨します。`

ADOP の本文になく、synsk.me に当てはめるために選んだものは次のとおり。

- 3 つの層を `features/<名前>/` の中に置く
- Others を `components/`（UI）と `server/`（インフラ）に分ける
- `app/` の `page.tsx` を Others（UI）とする

### 依存の向き

1. 機能どうしは import しない
2. `shared/` は `features/` を import しない
3. `'use client'` のファイルは `server/` を import しない。`server/` を呼ぶのは `page.tsx`・`layout.tsx` と Server Component
4. `domain/` は `server/` も `components/` も import しない
5. `application/` は `server/` も `components/` も直接 import しない。インタフェースを介す

規則 5 は、ADOP のルール 2 から来ている。

### Consequences

* Good, because nrs は ADOP について `ADOP にはクリーンアーキテクチャほど厳密ではないため、多大なる負担を開発者に求めません。` と書いている
* Bad, because 3 つの層を `features/<名前>/` の中に置くこと、Others を `components/` と `server/` に分けること、`page.tsx` を Others（UI）とすることは、ADOP の本文にない当てはめである
* Bad, because `app/` の外に `features/` を置くことは、Next.js のドキュメントを根拠にできない。根拠は Netflix/metaflow-ui のツリーの観察と選択である
* Bad, because ユースケースの層が加わり、リポジトリの実装を誰が `application/` に渡すかを決めることになる。ADOP の例は IoC Container を使う。[ADR-0030](./0030-composition-function-per-feature.md) で決めた
* Bad, because ユースケースの層が加わり、認可の検査をどの層で行うかを見直すことになる。ADOP の本文には、セッション情報を `汎化して実装したオブジェクトを利用します` という記述がある。公開してよい状態かを確かめる場所は [ADR-0029](./0029-visibility-check-at-retrieval.md) で決めた
* Bad, because ADOP の本文は、画面の側へ返すデータの形を定めていない。Next.js の Data Access Layer は `Return safe, minimal Data Transfer Objects (DTOs).` とし、Martin の記事は `We don’t want to cheat and pass Entities or Database rows.` とする。[ADR-0028](./0028-dto-for-screens.md) で決めた

### Confirmation

依存の向きの規則 1〜5 は、静的解析で検査する（[ADR-0033](./0033-code-conventions-as-static-analysis.md)）。コードをどの層に置くかの判断を判定する手段は定めていない。

## Pros and Cons of the Options

### nrs の ADOP をもとにした形（版 A） — 採用

Decision Outcome の「ディレクトリの形」のとおり。

* Good, because nrs は `ADOP にはクリーンアーキテクチャほど厳密ではないため、多大なる負担を開発者に求めません。` と書いている
* Neutral, because 層は 3 つで、外側を Others にまとめ、技術ごとに分ける
* Neutral, because 画面への出力は、UI の側がユースケースを呼び、結果を受け取る
* Neutral, because リポジトリのインタフェースは Domain に置く（ADOP の既定）

### Martin の記事と DDD Reference に忠実な形（版 B）

Martin の記事（2012-08-13）と DDD Reference（© 2015）に忠実な形。

```
src/
├── app/                      Frameworks and Drivers。page.tsx はつなぐだけ
├── features/<名前>/
│   ├── domain/               Entities の円
│   ├── use-cases/            Use Cases の円。出力とリポジトリのインタフェース
│   └── adapters/
│       ├── presenters/
│       ├── repositories/
│       └── components/       Views
└── shared/
```

* Neutral, because 層は 4 つで、Interface Adapters と Frameworks and Drivers を分ける
* Neutral, because ユースケースが出力のインタフェースを呼び、プレゼンターが実装する: `So we have the use case call an interface (Shown here as Use Case Output Port) in the inner circle, and have the presenter in the outer circle implement it.`
* Neutral, because リポジトリのインタフェースは Use Cases の円に置く。Martin の出力のインタフェースの例に倣った案であり、Martin も DDD Reference も場所は定めていない
* Bad, because nrs は `その一方でクリーンアーキテクチャの実装例は相当のコード量を要求します。` と書いている

## More Information

- [nrs: ADOP (Application Domain Others Pattern)](https://nrslib.com/adop/)（公開 2020-12-13、更新 2021-04-23）
- [nrs: clean-ddd-entity](https://nrslib.com/clean-ddd-entity/)（2019-03-08）
- [nrs: clean-architecture](https://nrslib.com/clean-architecture/)（2018-09-09）
- [Martin: Clean](http://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)（2012-08-13）
- [Evans: Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)（© 2015）
- [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)

関連する決定の記録

- [ADR-0027: `features/` はもの（データ）の名前で切る](./0027-feature-naming.md)
