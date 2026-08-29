---
status: accepted
date: 2026-08-27
decision-makers: synsk
---

# URL の規則

## Context and Problem Statement

URL を変えると、外部プラットフォームへ転載した記事から synsk.me を指す canonical が壊れる（[ADR-0006](./0006-posse-publishing-strategy.md)）。転載先に設定した値は、こちらから直せない。このため URL の安定性が、他のサイトより高い代償を持つ。

2026-08-26 に、URL の設計に関する規約と実例を調べた。RFC 3986 が使える文字と階層の区切りを定めている。W3C の Cool URIs は、著者名・主題の分類・状態・アクセス権・拡張子を URL に入れないとしている。Rails と Laravel は、リソースに対する操作を7つの経路で表す規約を持つ。WordPress は permalink の形に名前を与えている。Google は ID より単語を、アンダースコアよりハイフンを推している。

記事を扱うサービスの URL を実測した。Medium は題を URL に含めるが、解決は末尾のハッシュで行う。でたらめな題を与えても正しい URL へ転送された。Qiita は題を URL に含めない。Zenn は題とは別に英数字の識別子を持つ。いずれも題そのものを識別子にしていない。

表示の分類（`works` / `writing` / `activity` / `misc`）は手動で上書きできる設計になっている（[ADR-0003](./0003-content-data-model.md)）。これを URL に含めると、上書きのたびに URL が変わる。

職務経歴書を複数保持し、何を軸に分けるかを定めない方針を決めた（[ADR-0015](./0015-multiple-resumes.md)）。識別子で軸を表すことになる。

## Decision Drivers

* [余白 over 密度](../PRINCIPLES.md#1-余白-1)

## Considered Options

識別子の形

* 題をそのまま識別子にする
* 題を URL に含め、末尾のハッシュで解決する
* 題とは別に識別子を持つ

管理画面の位置

* 公開物の隣に置く
* 前置きにまとめる

絞り込みの扱い

* パスで表す
* クエリで表し、操作でも書き込む
* 書き込まず、読むだけ

## Decision Outcome

**URL は resourceful routing に従い、コレクション名と識別子で表す。**

- 識別子は英数字の slug とする。題から候補を提示し、作り手が確定させる。slug を持たせない場合は ID を振る
- permalink を持つのは internal コンテンツ、project、職務経歴書とする
- 外部から取得した activity は synsk.me 上に URL を持たず、取得元へ直接リンクする
- 管理画面は `/dash/` 配下に置く
- 表示の絞り込みを URL に書き込まない。クエリ文字列で指定された場合は初期状態として読む
- 末尾にスラッシュを付けない
- 歴代サイトは年ごとのサブドメインに置く

### Consequences

* Good, because 題を直しても URL が変わらない
* Good, because 転載先に設定した canonical が壊れない
* Good, because `/notes` `/projects` `/resume` を切れば、それぞれの一覧に辿り着ける
* Bad, because 記事を書くたびに識別子を確定させる操作が挟まる
* Bad, because 公開ページの URL を書き換えないと編集画面に入れない
* Bad, because **同じ slug を二度使えない。** 過去に使った識別子は、その記事が存在する限り再利用できない
* Bad, because **絞り込んだ状態を共有したあと、相手の操作は URL に反映されない。** 送った URL と、相手が見ているものがずれる

## Pros and Cons of the Options

### 識別子の形

**Option A: 題をそのまま識別子にする** — 手数が増えない。ただし題を変えると URL を変えるか、題と URL がずれるかになる。日本語の題ではエンコードされて長くなる。

**Option B: 題を URL に含め、末尾のハッシュで解決する** — 読めて、題を変えても壊れない。ただし同じ記事に複数の URL が生じ、転送の仕組みが要る。Medium がこの形。

**Option C: 題とは別に識別子を持つ — 採用** — 題を自由に直せる。URL は変わらない。題から候補を提示することで、決める手数を抑える。決めきれない場合は ID を振る。Zenn がこの形。

### 管理画面の位置

**Option A: 公開物の隣に置く**（`/notes/{slug}/edit`）— 読んでいる URL に足すだけで編集に入れる。ただし公開ページを持たない管理画面の置き場が決まらない。

**Option B: 前置きにまとめる — 採用** — 認証の境界が1つの経路で表せる。読んでいる URL から直接は入れない。

### 絞り込みの扱い

**Option A: パスで表す**（`/writing`）— 事前生成でき、共有できる。ただし分類は手動で上書きできるため、上書きすると URL が変わる。

**Option B: クエリで表し、操作でも書き込む** — 共有でき、戻る操作でも戻れる。ただし同じ内容に複数の URL が生じる。

**Option C: 書き込まず、読むだけ — 採用** — URL が1つに保たれる。絞り込んだ状態を共有できるが、その後の操作は URL に反映されない。

## References

- [ADR-0003: コンテンツデータモデル設計（C: 分離モデル）](./0003-content-data-model.md)
- [ADR-0006: 発信戦略として POSSE を採用する](./0006-posse-publishing-strategy.md)
- [ADR-0015: 職務経歴書を複数保持する](./0015-multiple-resumes.md)
- [Cool URIs don't change](https://www.w3.org/Provider/Style/URI)
- [RFC 3986: URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)
- [Rails Guides: Routing](https://guides.rubyonrails.org/routing.html)
- [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure)
