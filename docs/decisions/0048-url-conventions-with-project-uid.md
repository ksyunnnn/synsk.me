---
status: proposed
date: 2026-11-04
decision-makers: synsk
consulted: Claude Code
---

# URL の規則（実績の識別子は既定で uid）

## Context and Problem Statement

[ADR-0016](./0016-url-conventions.md) は、URL を resourceful routing に従ってコレクション名と識別子で表すと決めた。識別子については「英数字の slug とする。題から候補を提示し、作り手が確定させる。slug を持たせない場合は ID を振る」とし、「permalink を持つのは internal コンテンツ、project、職務経歴書とする」とした。

[#72](https://github.com/ksyunnnn/synsk.me/issues/72) で、オーナーは次のことを決めた。

- 全表の主キーを連番の整数にする。note・project・resume の URL には主キーとは別の slug を出し、主キーは出さない。slug を決めないときに何を入れるかは実装のときに決める（[6334856341](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334856341)）
- 実績は slug の URL で個別のページを持つ。秘匿化した実績も個別のページを持つ（2026-11-04）
- 実績の slug は既定で uid にする。オーナーは読みやすい slug に書き換えられる。秘匿化した実績の slug は uid のまま固定する。秘匿化していない実績を秘匿化に切り替えると、slug は新しい uid に戻る（2026-11-04）

実績の個別のページは、2026-10-23 に「slug の扱いも含めて保留」とされていた（[6331022192](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6331022192)）。2026-11-04 の決定で、ADR-0016 の「permalink を持つのは project」は保たれる。

ADR-0016 の「題から候補を提示し、作り手が確定させる」は、実績の slug を既定で uid にする決定と食い違う。秘匿化した実績の slug に題から作った候補を使うと、URL から実際の題が読める。「slug を持たせない場合は ID を振る」は、ID を主キーと読むと、主キーを URL に出さない決定と食い違う。

「internal コンテンツ」は、[ADR-0023](./0023-note-naming.md) により `platform` が `internal` のすべてを指す。`platform` の値は [ADR-0043](./0043-d1-column-naming.md) と [ADR-0044](./0044-content-data-model-by-organization.md) で無くなり、activity は外部の取得元から取った項目と life event だけを持つ。

ADR-0016 が調べた事実は、次のとおり変わっていない。

URL を変えると、外部プラットフォームへ転載した記事から synsk.me を指す canonical が壊れる（[ADR-0006](./0006-posse-publishing-strategy.md)）。転載先に設定した値は、こちらから直せない。

2026-08-26 に、URL の設計に関する規約と実例を調べた。RFC 3986 が使える文字と階層の区切りを定めている。W3C の Cool URIs は、著者名・主題の分類・状態・アクセス権・拡張子を URL に入れないとしている。Rails と Laravel は、リソースに対する操作を7つの経路で表す規約を持つ。WordPress は permalink の形に名前を与えている。Google は ID より単語を、アンダースコアよりハイフンを推している。

記事を扱うサービスの URL を実測した。Medium は題を URL に含めるが、解決は末尾のハッシュで行う。Qiita は題を URL に含めない。Zenn は題とは別に英数字の識別子を持つ。いずれも題そのものを識別子にしていない。

職務経歴書を複数保持し、何を軸に分けるかを定めない方針を決めた（[ADR-0015](./0015-multiple-resumes.md)）。識別子で軸を表すことになる。

## Decision Drivers

* [余白 over 密度](../PRINCIPLES.md#1-余白-1)
* 秘匿化した実績の実際の題と組織名を、URL から読めないようにする

## Considered Options

識別子の形

* 題をそのまま識別子にする
* 題を URL に含め、末尾のハッシュで解決する
* 題とは別に識別子を持つ。候補は題から作る（ADR-0016 の形）
* 題とは別に識別子を持つ。実績の既定は uid にする

管理画面の位置

* 公開物の隣に置く
* 前置きにまとめる

絞り込みの扱い

* パスで表す
* クエリで表し、操作でも書き込む
* 書き込まず、読むだけ

## Decision Outcome

**URL は resourceful routing に従い、コレクション名と識別子で表す。**

- 識別子は英数字の slug とする。主キーは URL に出さない
- note と職務経歴書の slug は、題から候補を提示し、作り手が確定させる
- 実績の slug は、既定で uid とする。uid は題や組織名から推測できない。オーナーは、秘匿化していない実績の slug を書き換えられる。秘匿化した実績の slug は uid から変えられない。秘匿化していない実績を秘匿化に切り替えると、slug は新しい uid に戻る
- permalink を持つのは note、実績、職務経歴書とする。秘匿化した実績も permalink を持つ
- 外部から取得した activity は synsk.me 上に URL を持たず、取得元へ直接リンクする
- 管理画面は `/dash/` 配下に置く
- 表示の絞り込みを URL に書き込まない。クエリ文字列で指定された場合は初期状態として読む
- 末尾にスラッシュを付けない
- 歴代サイトは年ごとのサブドメインに置く

### Consequences

* Good, because 題を直しても URL が変わらない
* Good, because 転載先に設定した canonical が壊れない
* Good, because `/notes` `/projects` `/resume` を切れば、それぞれの一覧に辿り着ける
* Good, because 秘匿化した実績の URL から、実際の題と組織名が読めない
* Bad, because note を書くたびに識別子を確定させる操作が挟まる
* Bad, because 公開ページの URL を書き換えないと編集画面に入れない
* Bad, because **同じ slug を二度使えない。** 過去に使った識別子は、その記事が存在する限り再利用できない
* Bad, because **実績を秘匿化に切り替えると、その実績の URL が変わる。** 切り替える前の URL を共有した相手は、その実績に辿り着けない
* Bad, because **life event が permalink を持つかを決めていない。** ADR-0016 の「internal コンテンツ」に当たるかが、`platform` の値が無くなって読めなくなった
* Bad, because **絞り込んだ状態を共有したあと、相手の操作は URL に反映されない。** 送った URL と、相手が見ているものがずれる

### Confirmation

project の slug が一意であることは、`migrations/` の CREATE TABLE で確かめられる。

秘匿化した実績の slug が uid から変わらないこと、主キーが URL に出ないことは、判定手段を定めていない。実績の画面は、この記録の時点でリポジトリにない。

## Pros and Cons of the Options

### 識別子の形

**題をそのまま識別子にする** — 手数が増えない。ただし題を変えると URL を変えるか、題と URL がずれるかになる。日本語の題ではエンコードされて長くなる。

**題を URL に含め、末尾のハッシュで解決する** — 読めて、題を変えても壊れない。ただし同じ記事に複数の URL が生じ、転送の仕組みが要る。Medium がこの形。

**題とは別に識別子を持つ。候補は題から作る（ADR-0016 の形）** — 題を自由に直せる。URL は変わらない。ただし秘匿化した実績では、題から作った候補が実際の題を URL に出す。Zenn がこの形。

**題とは別に識別子を持つ。実績の既定は uid にする — 採用** — 題を自由に直せる。秘匿化した実績の URL に実際の題が出ない。秘匿化していない実績は、読みやすい slug に書き換えられる。

### 管理画面の位置

**公開物の隣に置く**（`/notes/{slug}/edit`）— 読んでいる URL に足すだけで編集に入れる。ただし公開ページを持たない管理画面の置き場が決まらない。

**前置きにまとめる — 採用** — 認証の境界が1つの経路で表せる。読んでいる URL から直接は入れない。

### 絞り込みの扱い

**パスで表す**（`/writing`）— 事前生成でき、共有できる。ただし表示の分類を URL に含めると、分類が変わったときに URL が変わる。

**クエリで表し、操作でも書き込む** — 共有でき、戻る操作でも戻れる。ただし同じ内容に複数の URL が生じる。

**書き込まず、読むだけ — 採用** — URL が1つに保たれる。絞り込んだ状態を共有できるが、その後の操作は URL に反映されない。

## More Information

この記録は [ADR-0016](./0016-url-conventions.md) を置き換える。ADR-0016 の識別子の決め方と permalink を持つものの行を改め、ほかはこの記録が引き継ぐ。

- [ADR-0006: 発信戦略として POSSE を採用する](./0006-posse-publishing-strategy.md)
- [ADR-0015: 職務経歴書を複数保持する](./0015-multiple-resumes.md)
- [ADR-0023: synsk.me が持つ記事を note と呼ぶ](./0023-note-naming.md)
- [ADR-0047: 職歴と実績は秘匿化の有無で出し分け、限定公開は職務経歴書だけが持つ](./0047-visibility-by-masking-and-resume-audience.md)
- [Cool URIs don't change](https://www.w3.org/Provider/Style/URI)
- [RFC 3986: URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)
- [Rails Guides: Routing](https://guides.rubyonrails.org/routing.html)
- [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure)
