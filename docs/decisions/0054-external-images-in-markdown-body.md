---
status: accepted
date: 2026-11-11
decision-makers: synsk
consulted: Claude Code
---

# 本文で http と https の外の URL の画像も出す

## Context and Problem Statement

001 の職歴・実績の本文と 003 の note の本文は、同じ部品（`src/shared/components/markdown-body.tsx`）で Markdown を描く。この部品は、置き場の画像を指す `media:<storageKey>` の画像だけを `<img>` にし、ほかの URL の画像は代替テキストの文字列で出していた。

2026-11-11 に、次の事実が分かった（[issue #219 の宣言](https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6784582330)）。

- Preview の実績の本文に書いた `![](https://proff-prod.s3.amazonaws.com/...)` が画像で出なかった
- 手元の種のデータ（`private/seed-local.sql`）の本文には、外の URL の画像が 20 個ある

react-markdown 10.1.0 の `defaultUrlTransform` は、`http`・`https`・`ircs?`・`mailto`・`xmpp` のスキームと相対の URL をそのまま通し、ほかのスキーム（`javascript:`・`data:` など）を空の文字列にする（`node_modules/react-markdown/lib/index.js` の `safeProtocol`、2026-11-11 に確かめた）。

本文の外の URL の画像を、訪問者に画像で出すかを決める。

## Decision Drivers

* [たどり着きたい情報 over 演出](../PRINCIPLES.md#5-たどり着きたい情報)。本文に書いた画像が文字で出ると、読み手は書いた人が見せたかったものにたどり着けない
* [守る over 手軽さ](../SOFTWARE_DESIGN.md#1-守る-over-手軽さ)。画像にする URL のスキームを限り、秘匿化した実績の本文は出さない
* [単純さ over 先回りの構造](../SOFTWARE_DESIGN.md#9-単純さ-over-先回りの構造)。取りに行く処理と保管を持たない

## Considered Options

* 外の画像を置き場に移し、本文を `media:` に書き換える
* 本文で http と https の外の URL の画像も出す
* 置き場の画像だけを出す

## Decision Outcome

Chosen option: "本文で http と https の外の URL の画像も出す", because オーナーが、本文に書いた画像が出ないのは使い手にとって分かりにくいとして選んだため。PM は置き場に移す案を推したが、オーナーは推奨の形にせず、出せるようにすることを選んだ。

- 画像の URL の欄に `http:` か `https:` の絶対 URL を書いた画像は、`<img>` で出す。`media:<storageKey>` の画像と同じく、画像だけの段落は `<figure>` にし、すぐ下の行の強調を `<figcaption>` にし、題の欄を `title` にする
- ほかの URL（`javascript:`・`data:`・`ftp:`・相対の URL・`//` で始まる URL）の画像は、画像にせず代替テキストで出す
- 外の URL の画像は、サイトが取りに行かず、保管も変換もしない。訪問者のブラウザが画像のサーバから直接読む
- 外の URL の画像の `<img>` は `loading="lazy"`・`decoding="async"`・`referrerPolicy="no-referrer"` を持つ。参照元のページの URL を画像のサーバへ送らない
- 範囲は `markdown-body.tsx` で描く本文のすべて（001 の職歴・実績、003 の note）。秘匿化した職歴・実績は、本文を出さないため、外の URL も応答に含めない
- 外の URL の画像は、置き場の画像の持ち主・配る経路・見せてよいかの確かめ（001 の FR-030、003 の FR-026）の対象にならない。本文を出す表示でだけ出る

### Consequences

* Good, because 本文に書いた外の画像が、書いたとおりに画像で出る
* Good, because 取りに行く処理・保管・変換を持たず、置き場の容量を使わない
* Bad, because 訪問者のブラウザが画像のサーバに接続し、そのサーバは訪問者の IP アドレスと User-Agent を受け取る。参照元のページの URL は送らない
* Bad, because 画像のサーバが画像を消すか止めると、本文の画像が出なくなる。サイトはそれを知らない
* Bad, because 画像の大きさと形式を確かめないため、置き場の画像の上限（1 枚 10 MB、JPEG・PNG・WebP・GIF）が外の URL の画像には効かない

### Confirmation

- `tests/unit/markdown.test.ts` が、http と https の外の URL の画像が `<img>` と `<figcaption>` になり、ほかの URL の画像が代替テキストのままであることを確かめる
- `tests/integration/project-masking.test.ts` と `tests/integration/notes.test.ts` が、実績と note のページの応答に外の URL の画像が出て、秘匿化した実績の応答に外の URL が含まれないことを確かめる

## Pros and Cons of the Options

### 外の画像を置き場に移し、本文を `media:` に書き換える

* Good, because 画像をサイトが持ち、外のサーバが止めても出る。訪問者が外のサーバに接続しない
* Bad, because 外の画像を書いた本文ごとに、オーナーが画像を移して本文を書き換える手間がかかる

### 本文で http と https の外の URL の画像も出す — 採用

* Good, because 書いた本文がそのまま出る
* Bad, because 画像の出どころがサイトの外にあり、消えても気づけない

### 置き場の画像だけを出す

* Good, because 画像はすべて置き場の確かめを通る
* Bad, because 外の画像を書いた本文は、画像の場所に代替テキストだけが出る

## More Information

- [MDN: HTMLImageElement: referrerPolicy property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy)
- [MDN: HTMLImageElement: loading property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading)
- [MDN: HTMLImageElement: decoding property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding)
