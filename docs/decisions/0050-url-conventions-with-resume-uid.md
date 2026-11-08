---
status: proposed
date: 2026-11-09
decision-makers: synsk
consulted: Claude Code
---

# URL の規則（実績・life event・職務経歴書の識別子は既定で uid）

## Context and Problem Statement

[ADR-0048](./0048-url-conventions-with-project-uid.md) は、URL をコレクション名と識別子で表すと決めた。識別子については「note と職務経歴書の slug は、題から候補を提示し、オーナーが確定させる」とし、実績と life event の slug は既定で uid とした。

`specs/002-resume/spec.md` は、職務経歴書の識別子を次のように定める。

- 限定公開用の識別子は、題や提出先から推測できない uid である。オーナーは識別子を手で書き換えられない。識別子が変わるのは、URL を出し直したときだけである（FR-037）
- 公開用の識別子は、既定で uid である。オーナーは読みやすい識別子に書き換えられる（FR-039）
- 限定公開用の URL は識別子だけで作り、識別子を知っている人が読める（FR-011）。出し直すと識別子を新しい uid に作り直し、古い URL では中身を返さない（FR-040）

ADR-0048 の「題から候補を提示し、オーナーが確定させる」は、職務経歴書についてこれらと食い違う。限定公開用では識別子が URL を開く鍵を兼ねるため、題や提出先から作った候補を使うと、URL を推測できる。`specs/002-resume/research.md` の R5 は、この食い違いを挙げ、ADR を直すかをオーナーに委ねている。

ADR-0048 のほかの決定は変わっていない。[docs/decisions/README.md](./README.md) は、承認した記録の決定内容を変えず、覆すときは新しい記録を書くと定める。1 行だけを覆すときも、元の記録をまるごと引き継ぐ新しい記録を書く（[#72 のコメント 6231369601](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6231369601)）。この記録は ADR-0048 を引き継ぎ、職務経歴書の識別子の行を置き換える。

ADR-0048 が挙げた事実のうち、この記録の決定に効くものは次のとおり変わっていない。

- URL を変えると、外部プラットフォームへ転載した記事から synsk.me を指す canonical が壊れる（[ADR-0006](./0006-posse-publishing-strategy.md)）
- 記事を扱うサービス（Medium・Qiita・Zenn）は、いずれも題そのものを識別子にしていない
- 職務経歴書を複数保持し、何を軸に分けるかを定めない（[ADR-0015](./0015-multiple-resumes.md)）

## Decision Drivers

* [余白 over 密度](../PRINCIPLES.md#1-余白-1)
* 秘匿化した実績の実際の題と組織名を、URL から読めないようにする
* 限定公開用の職務経歴書の URL を、題や提出先から推測できないようにする

## Considered Options

識別子の形

* 題をそのまま識別子にする
* 題を URL に含め、末尾のハッシュで解決する
* 題とは別に識別子を持つ。候補は題から作る（ADR-0016 の形）
* 題とは別に識別子を持つ。実績と life event の既定は uid にする（ADR-0048 の形）
* 題とは別に識別子を持つ。実績・life event・職務経歴書の既定は uid にする

管理画面の位置と絞り込みの扱いは、ADR-0048 の選択肢と同じ。

## Decision Outcome

Chosen option: "題とは別に識別子を持つ。実績・life event・職務経歴書の既定は uid にする", because 限定公開用の職務経歴書は識別子だけで読めるため、識別子が題や提出先から推測できると、渡していない人にも読める。

**URL は resourceful routing に従い、コレクション名と識別子で表す。**

- 識別子は英数字の slug とする。主キーは URL に出さない
- note の slug は、題から候補を提示し、オーナーが確定させる
- 限定公開用の職務経歴書の slug は uid とし、オーナーは書き換えられない。URL を出し直したときだけ、新しい uid に変わる
- 公開用の職務経歴書の slug は、既定で uid とする。オーナーは書き換えられる
- 実績の slug は、既定で uid とする。uid は題や組織名から推測できない。オーナーは、秘匿化していない実績の slug を書き換えられる。秘匿化した実績の slug は uid から変えられない。秘匿化していない実績を秘匿化に切り替えると、slug は新しい uid に戻る
- life event の slug は、既定で uid とする。オーナーは書き換えられる
- permalink を持つのは note、実績、life event、職務経歴書とする。秘匿化した実績も permalink を持つ
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
* Good, because 限定公開用の職務経歴書の URL から、題と提出先が読めず、URL を推測できない
* Bad, because note を書くたびに識別子を確定させる操作が挟まる
* Bad, because 公開ページの URL を書き換えないと編集画面に入れない
* Bad, because **同じ slug を二度使えない。** 過去に使った識別子は、その記事が存在する限り再利用できない
* Bad, because **実績を秘匿化に切り替えると、その実績の URL が変わる。** 切り替える前の URL を共有した相手は、その実績に辿り着けない
* Bad, because **限定公開用の URL を出し直すと、出し直す前の URL を渡した提出先は読めなくなる。** 読ませ続けるには、新しい URL を渡し直す
* Bad, because **絞り込んだ状態を共有したあと、相手の操作は URL に反映されない。** 送った URL と、相手が見ているものがずれる

### Confirmation

project と resume の slug が一意であることは、`migrations/` の CREATE TABLE で確かめられる。life event の slug が一意であること、life event だけが slug を持つことは、`migrations/` の activity の CHECK と部分 UNIQUE 索引で確かめられる。

限定公開用の URL を出し直すと識別子が新しい uid に変わり、古い識別子では読めないことは、`tests/workers/resume-edit.test.ts` の「URL の出し直し（FR-040）」が確かめる。実績を秘匿化に切り替えると古い識別子が 404 になることは、`tests/integration/project-masking.test.ts` が確かめる。

秘匿化した実績の slug が uid から変わらないこと、限定公開用の職務経歴書の slug をオーナーが書き換えられないことは、判定手段を定めていない。この記録を書いた時点で、どちらを確かめるテストも見つけられなかった。

## Pros and Cons of the Options

### 識別子の形

**題をそのまま識別子にする** — 手数が増えない。ただし題を変えると URL を変えるか、題と URL がずれるかになる。日本語の題ではエンコードされて長くなる。

**題を URL に含め、末尾のハッシュで解決する** — 読めて、題を変えても壊れない。ただし同じ記事に複数の URL が生じ、転送の仕組みが要る。Medium がこの形。

**題とは別に識別子を持つ。候補は題から作る（ADR-0016 の形）** — 題を自由に直せる。URL は変わらない。ただし秘匿化した実績では、題から作った候補が実際の題を URL に出す。Zenn がこの形。

**題とは別に識別子を持つ。実績と life event の既定は uid にする（ADR-0048 の形）** — 秘匿化した実績の URL に実際の題が出ない。ただし限定公開用の職務経歴書では、題や提出先から作った候補が、URL を開く鍵を推測できるものにする。

**題とは別に識別子を持つ。実績・life event・職務経歴書の既定は uid にする — 採用** — 題を自由に直せる。秘匿化した実績と限定公開用の職務経歴書の URL に、題と提出先が出ない。秘匿化していない実績、life event、公開用の職務経歴書は、読みやすい slug に書き換えられる。

## More Information

この記録は [ADR-0048](./0048-url-conventions-with-project-uid.md) を置き換える。ADR-0048 の「note と職務経歴書の slug は、題から候補を提示し、オーナーが確定させる」のうち職務経歴書の部分を改め、ほかはこの記録が引き継ぐ。管理画面の位置と絞り込みの扱いの比較は、ADR-0048 の Pros and Cons of the Options にある。

- [ADR-0006: 発信戦略として POSSE を採用する](./0006-posse-publishing-strategy.md)
- [ADR-0015: 職務経歴書を複数保持する](./0015-multiple-resumes.md)
- [ADR-0047: 職歴と実績は秘匿化の有無で出し分け、限定公開は職務経歴書だけが持つ](./0047-visibility-by-masking-and-resume-audience.md)
- [Cool URIs don't change](https://www.w3.org/Provider/Style/URI)
- [RFC 3986: URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)
