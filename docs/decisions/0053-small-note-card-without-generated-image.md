---
status: accepted
date: 2026-11-10
decision-makers: synsk
consulted: Claude Code
---

# note のカードは小さい画像のカードにし、題を入れた画像を作らない

## Context and Problem Statement

[ADR-0024](./0024-machine-readers.md) は、機械の読み手にどう振る舞うかを決めた。その「差し出し方」の 1 行が、note のカード画像を、題を入れた自動生成・note に追加した画像・サイト共通のアイキャッチから選び、既定を自動生成とする。この記録は、ADR-0024 のこのカード画像の部分だけを置き換える。ADR-0024 のほかの決定は変えない。

2026-11-10 にオーナーが次のように決めた（[issue #219 の U8 の報告](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6766846712)）。

- 題を入れた画像を自動で作る機能は持たない。synsk.me はメディアのサイトではないため
- note を SNS で共有したとき、大きな画像のカードではなく、小さい画像の隣に文字が並ぶカードにする。サイト共通の画像とサイト全体の設定は変えない
- 大きな画像を強制する SNS が現れたら、そのときに自動で作ることを検討する
- note に追加した画像を使うときは、その画像の大きさに従い、縮めない
- 代表画像を選ばない note は、note 用のサイト共通の 400×400 の画像を使う。画像はオーナーが用意する。用意するまでは、カードに画像を付けない。仮の画像は、索引されるのを避けるため置かない

カードの形について、2026-11-10 に公式のドキュメントで確かめた事実は次のとおり。

- X は `twitter:card` が `summary` なら小さいカードで、画像は 1:1、最小 144×144（developer.x.com の Summary Card。402 を返したため web.archive.org の 2025-12-16 の写しで読んだ）
- Facebook は「If your image is smaller than 600 x 315 px, it will still display in the link page post, but the size will be much smaller.」とし、最小を 200×200 とする
- LinkedIn は「Images less than 401 pixels wide display as a thumbnail image.」とする
- Slack・Discord・Mastodon・LINE・Bluesky・Threads は、カードの形の決め方を公式に書いていない

## Decision Drivers

* [対話 over 展示](../PRINCIPLES.md#3-対話)
* オーナーが選んだ画像は、その大きさのまま使う
* 用意していない画像を、仮のものでも索引させない

## Considered Options

* 題を入れた画像を自動で作る（ADR-0024 の形）
* `twitter:card` を `summary` にし、画像は縮めない
* `twitter:card` を `summary` にし、共有したときの画像を 400×400 に縮める

## Decision Outcome

Chosen option: "`twitter:card` を `summary` にし、画像は縮めない", because オーナーが、題を入れた画像を作らず、選んだ画像はその大きさに従うと決めたため。

- note のカードは、小さい画像の隣に文字が並ぶ形にし、`twitter:card` を `summary` にする。サイト全体のカードの形とサイト共通の 1200×630 の画像は変えない
- note のカード画像は、note に追加した画像と、note 用のサイト共通の 400×400 の画像から選ぶ。既定は後者。題を入れた画像は作らない
- note に追加した画像は縮めずに使う
- note 用のサイト共通の 400×400 の画像は、オーナーが用意するまでカードに付けない

### Consequences

* Good, because 題を入れた画像を作る処理と、その使い回しを持たない
* Good, because オーナーが選んだ画像が、選んだときの大きさのまま出る
* Bad, because note ごとの区別は、オーナーが画像を選んだ note でしかつかない
* Bad, because 大きな画像を選んだ note は、Facebook と LinkedIn では大きなカードで出る。この 2 つは画像の大きさでカードの形を決める
* Bad, because note 用のサイト共通の 400×400 の画像を用意するまで、代表画像を選ばない note のカードに画像が無い
* Bad, because 大きな画像を強制する SNS では、note のカードが小さく、または画像なしで出うる

### Confirmation

- note のページの `twitter:card` が `summary` で、`og:image` と `twitter:image` が、代表画像を選んだ note では縮めない原本を指し、選ばない note では出ない。`tests/integration/notes.test.ts` が本番のビルド出力で確かめる
- トップページの `twitter:card` が `summary_large_image` のままである。`tests/integration/routes.test.ts` が確かめる
- `note.card_image` の CHECK が、題を入れた自動生成の値を持たない（`migrations/0024_remove_generated_card_image_from_note.sql`）

## Pros and Cons of the Options

### 題を入れた画像を自動で作る（ADR-0024 の形）

* Good, because どの note のカードにも、その note の題の入った画像が出る
* Bad, because 画像を作る処理と使い回しの仕組みが要る。メディアのサイトでない synsk.me には見合わない

### `twitter:card` を `summary` にし、画像は縮めない — 採用

* Good, because オーナーが選んだ画像の大きさに従う
* Bad, because Facebook と LinkedIn では、大きな画像を選んだ note が大きく出る

### `twitter:card` を `summary` にし、共有したときの画像を 400×400 に縮める

* Good, because X・Facebook・LinkedIn のどれでも小さいカードになる
* Bad, because オーナーが選んだ画像を縮める。オーナーは縮めないと決めた

## More Information

- [ADR-0024: 機械の読み手を歓迎し、キャッシュで受ける](./0024-machine-readers.md)。この記録は、その「差し出し方」のカード画像の 1 行と、題を入れたカード画像の CPU 時間の Consequences を置き換える
- [X: Summary Card](https://developer.x.com/en/docs/x-for-websites/cards/overview/summary)
- [Facebook: Images in Link Shares](https://developers.facebook.com/docs/sharing/webmasters/images/)
- [LinkedIn: Make your website shareable on LinkedIn](https://www.linkedin.com/help/linkedin/answer/a521928)
