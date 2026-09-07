---
status: accepted
date: 2026-09-08
decision-makers: synsk
consulted: Claude
---

# 昇格直後にキャッシュと配信中の版が食い違う窓を許容する

## Context and Problem Statement

[#71](https://github.com/ksyunnnn/synsk.me/issues/71) として、`main` へのマージで走るビルドが、デプロイ自体は成功した後に `npm run verify:deploy` の予算検査で落ちた。落ちたのは JS チャンクの取得で、`7f403d4` と `ccac343` のビルドでいずれも 7 本が 404 を返した。

2026-09-08 に調べて分かったこと。

**404 になるのは、そのデプロイで新しくアップロードされたアセットだけである。** 失敗した 2 ビルドで 404 になった 7 本（`index`・`vinext`・`Analytics`・`image`・`link`・`script`・`layout-segment-context`）は、いずれもビルドごとにハッシュが変わるものだった。ビルドをまたいで同じハッシュを持つ 4 本（`framework-DTZGTDtF`・`icon-DJpz0FJx`・`query-DugiHe4Q`・`rolldown-runtime-hePW80VL`）は 1 本も落ちていない。

**アセットの配布が遅れているのではない。** 現在の `main` をビルドして版 `ea015945` としてアップロードし、そのプレビュー URL に対して直後・5 秒後・15 秒後・30 秒後に HTML と参照チャンク 11 本を取得したところ、4 回とも 11 本すべてが 200 を返した。

原因は [ADR-0018](./0018-vinext-runtime.md) が採った配信の手順にある。`vinext-cloudflare deploy --experimental-warm-cdn-cache` は、版を 0% で置き、**昇格の前に**その版の HTML をエッジのキャッシュへ詰め、その後で昇格する。したがって昇格の直後には、キャッシュに新しい版の HTML があり、Worker はまだ古い版で応答しうる状態が生じる。キャッシュ済みの HTML が参照する新しいチャンクを古い版に求めると 404 になる。失敗した 2 ビルドはいずれも昇格の 2.2 秒後と 2.5 秒後に検査していた。通った `c9987d5` は 2.6 秒後であり、時間の長短では決まらない競合である。

この窓は検査だけの問題ではない。同じ数秒に訪れた人も、HTML は受け取るがチャンクが 404 になり、ハイドレーションが効かない。

## Decision Drivers

* [#38](https://github.com/ksyunnnn/synsk.me/issues/38) が戻したエッジのキャッシュを手放さないこと（[ADR-0018](./0018-vinext-runtime.md)）
* 検査が、実害のないときに赤くならないこと

## Considered Options

* 昇格と同時にエッジのキャッシュを purge する
* 古い版のアセットを一定期間そのまま配り続ける
* 窓を許容し、JavaScript が読めなくてもページが成立することを保つ
* warm をやめる

## Decision Outcome

**窓を許容する。** あわせて 2 つを固定する。

1. `scripts/verify-deploy.mjs` は、チャンクの検査に使う HTML を**エッジのキャッシュを迂回して**取る（`?__verify=<nonce>`）。HTML とチャンクが同じ版から来るため、伝播中でも食い違わない
2. JavaScript が読めない状態でもページが読め、遷移できることを `tests/e2e/no-js.spec.ts` が固定する。窓を許容できるのは、この前提が成り立つ間に限る

「昇格と同時に purge する」は、窓そのものを消す唯一の手段だが、Zone の Cache Purge 権限を持つ API トークンが要る。2026-09-08 時点の `CLOUDFLARE_API_TOKEN` で `POST /zones/{zone_id}/purge_cache` を試すと 401 を返す。権限を足せば採れる。

「古い版のアセットを配り続ける」は Cloudflare の Workers 静的アセットが版に紐づくため、こちらから制御できない。

「warm をやめる」はエッジのキャッシュを失う。[#61](https://github.com/ksyunnnn/synsk.me/issues/61) で直したものを戻すことになる。

### Consequences

* Good, because エッジのキャッシュ（[#38](https://github.com/ksyunnnn/synsk.me/issues/38)）を保ったまま、検査の間欠的な失敗がなくなる
* Good, because JavaScript なしでページが成立することが、テストとして固定される
* Bad, because 昇格の直後の数秒に訪れた人は、ハイドレーションが効かないページを受け取りうる。内容の閲覧と遷移はできるが、この状態を検知する手段を持たない
* Bad, because 窓を消す手段（purge）は API トークンの権限に依存し、リポジトリの中では完結しない

### Confirmation

`npm test` の `tests/unit/verify-deploy.test.ts` が、チャンクの抽出・PNG の判定・キャッシュ迂回の URL 生成を固定する。`npm run test:e2e` の `tests/e2e/no-js.spec.ts` が、JavaScript を切った Chromium でトップの見出しの表示とアーカイブへの遷移を確かめる。

窓そのものの長さは測っていない。測るには昇格の瞬間から連続して取得する必要があり、本番への昇格を伴う。

## More Information

- [#71](https://github.com/ksyunnnn/synsk.me/issues/71)
- [ADR-0018: Next.js を Cloudflare Workers 上で vinext を介して動かす](./0018-vinext-runtime.md)
- [ADR-0019: テストを 4 段階に分ける](./0019-testing-strategy.md)
