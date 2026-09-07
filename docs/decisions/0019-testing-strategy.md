---
status: accepted
date: 2026-09-07
decision-makers: synsk
---

# テストを 4 段階に分け、段階ごとに時間の上限を定める

## Context and Problem Statement

`src/` にテストが 1 本も存在しない。`.github/workflows` も存在せず、PR の時点で何も検査していない。

デプロイ後の検査だけは `scripts/verify-deploy.mjs`（173 行）が担っている。本番 URL に対して、HTML の経路が 200 と `text/html` を返すこと、画像の経路が PNG のシグネチャを持つこと、2 回目の要求が `cf-cache-status: HIT` を返すこと、HTML にアクセス解析が入ること、gzip 後の HTML が 8,000 バイト・JS が 200,000 バイト以下であることを検査する。依存を持たず、`npm run deploy` の末尾で走る。

一般的な Web アプリでテストする対象を、Google Testing Blog / Martin Fowler / ISTQB CTFL v4.0.1 / web.dev / MDN / OWASP WSTG v4.2 / W3C WAI / Google SRE Book から列挙したところ 20 のカテゴリに整理できた。そのうち `verify-deploy.mjs` が担うのは 5 つで、残りを担う手段がない。

Google SRE Book はテストを 2 系統に分ける。

> "Software tests broadly fall into two categories: traditional and production. (…) Production tests are performed on a live web service to evaluate whether a deployed software system is working correctly."

この区分に照らすと `verify-deploy.mjs` は production test にあたり、smoke / performance / configuration の定義に一致する。エッジのキャッシュ・ビルド時に埋まる環境変数・PNG の実体の 3 つは、デプロイ前には原理的に確かめられない。欠けているのは traditional test の側である。

速さの基準を持つ出典は 4 つある。Google Testing Blog "Test Sizes"（2010-12-13）が Small 60 秒 / Medium 300 秒 / Large 900 秒以上を定め、Humble と Farley の Continuous Delivery が commit stage を「ideally less than five minutes, certainly no more than ten minutes」とし、DORA が「less than ten minutes both on local workstations and from the continuous integration system」とし、Nielsen が応答時間の 3 閾値（0.1 / 1 / 10 秒）を示す。Vitest と Playwright の各公式は実行時間の推奨値を出していない。

Vitest の `latest` は 5.0.0 である。一方 `@cloudflare/vitest-plugin@1.1.4` の peer は `vitest: ^4.1.0` で、5.0.0 を受け付けない。このパッケージは D1 を workerd の中でテストする唯一の公式手段である。

Vitest Browser Mode の `browser.headless` の既定は `process.env.CI` であり、手元では `false` になってブラウザ画面が出る。Playwright の `headless` は既定 `true` である。


## Decision Drivers

* 実験 over 完璧な計画（[PRINCIPLES.md](../PRINCIPLES.md#2-実験)）。同原則は「低品質な実験は肯定しない」と但し書きを持つ

## Considered Options

* テストを段階に分けず、1 つの命令で全部を回す
* テストを 4 段階に分け、段階ごとに時間の上限を定める
* デプロイ後の検査だけを増やす

## Decision Outcome

**テストを 4 段階に分け、段階ごとに時間の上限を定める。**

| 段階 | 回すもの | Tolerable | Goal |
|---|---|---|---|
| 手元 watch | 変更に関係する単体のみ | 10 秒 | 1 秒 |
| コミット前 | 単体全部・D1・型検査・lint・format | 60 秒 | 30 秒 |
| PR の CI | 上記と結合・E2E（Chromium のみ）・a11y・ビジュアル回帰 | 10 分 | 5 分 |
| 定期 | 複数ブラウザ・ビジュアル回帰の全面更新 | — | — |

`scripts/verify-deploy.mjs` は残す。traditional test は production test を代替しない。

道具は次を採る。

- `vitest` — **4.1.11 に固定する**
- `@cloudflare/vitest-plugin` — D1 とマイグレーション
- `@playwright/test` — E2E・ビジュアル回帰・レスポンシブ
- `createTestHarness()` — 本番ビルド出力に対する結合

**Vitest Browser Mode は採らない。** ブラウザは Playwright が担う。

次は採らない。いずれも `docs/REQUIREMENTS.md` と `specs/` の要件に紐づかないためである。要件が足りないのであれば、道具ではなく要件を先に足す。

- `@axe-core/playwright` — `docs/REQUIREMENTS.md` にアクセシビリティの要件が 1 件もない。NFR-02 が扱うのはデータがない・読み込み中・一部欠損・エラーの各状態である。静的な検査は `eslint-plugin-jsx-a11y` が既に担う
- `web-vitals` を検査として回すこと — [ADR-0017](./0017-display-speed-thresholds.md) の Confirmation は 75 パーセンタイルでの判定を定める。ラボでの 1 回の計測は 75 パーセンタイルではない。フィールドの計測手段としては別に扱う
- `msw` — `specs/001` と `specs/002` にクライアント側の fetch がない。外部への呼び出しは FR-02 と FR-15 で、どちらも workerd の中で起きる
- `@stryker-mutator/*` — テストの対象になるコードが `src/lib/` の 3 ファイルしかない

実装が正しいことは、カバレッジ率では測らない。**意図的に欠陥を注入し、対応するテストが落ちることをカテゴリごとに確認する。**

### Consequences

* Good, because 手元で待つ時間が 10 秒以内に収まり、実験の速さを損なわない
* Good, because 可視性の選別（[ADR-0008](./0008-content-visibility.md) が「選別の漏れ」を Bad として記録している箇所）を、最も安い層で守れる
* Good, because ブラウザ画面が手元に出る経路がない
* Bad, because **Vitest の最新版を使えない。** 4.1.11 に固定する。`@cloudflare/vitest-plugin` が Vitest 5 に対応した時点で見直す
* Bad, because 段階が 4 つあるため、どこで何が落ちたかを人が把握する必要がある
* Bad, because **E2E の層が、いま守るものをほとんど持たない。** 要件に紐づく対象（`specs/001` の一覧から詳細への遷移、`specs/003` のエディタ）が実装されていない。置いた 3 本のうち、結合の層と重ならないのは JavaScript の実行時エラーの検査だけである。Playwright はブラウザバイナリ 94MB を要し、CI の時間を 55 秒から 1 分 37 秒へ増やす。対象が増えるまで、この増分は守るものに見合わない
* Bad, because **NFR-03 から NFR-07 は、この 4 段階のいずれでも判定できない。** web.dev が「lab measurement (…) is not a substitute for field measurement」と述べ、INP はラボで測れない。フィールド計測を別に持つ
* Neutral, because **`@cloudflare/vitest-plugin` と vinext は併用できる。** 2026-09-07 に実測した。vinext は `dist/shims/public-shim-map.json.js` が 24 件の写像を持ち、`next/link` `next/navigation` をはじめとする公開の `next/*` をすべて自前の shim に置き換えるため、vinext を読み込まない設定では `next/*` が `next` パッケージの実体へ解決される。したがって `next/*` を import するモジュールをこのプールの対象にしない。binding だけを扱う

### Confirmation

各段階の所要時間を実測し、上の表の Tolerable を満たすこと。CI では GitHub Actions のステップごとの所要時間で測る。手元では Vitest の Duration サマリと Playwright の `reportSlowTests` で測る。

意図的な欠陥の注入に対してテストが落ちることを、カテゴリごとに 1 本ずつ確認する。

## Pros and Cons of the Options

### 段階に分けず、1 つの命令で全部を回す

* Good, because 人が段階を意識しなくてよい
* Bad, because ブラウザの起動とビルドが毎回乗る。Nielsen の 10 秒を確実に超える

### テストを 4 段階に分け、段階ごとに時間の上限を定める — 採用

* Good, because 出典が定める数値をそのまま上限に使える
* Good, because 重い検査を人が待たない段へ寄せられる
* Bad, because 段階の割り当てを維持する手間がかかる

### デプロイ後の検査だけを増やす

* Good, because 既にある `verify-deploy.mjs` を伸ばすだけで済む
* Bad, because 変更が原因の欠陥を、本番に出るまで検出できない
* Bad, because Fowler が合成モニタリングを「a subset of an application's automated tests」と定義しており、本番でやることを増やす方向は出典の立場と逆になる

## More Information

- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0017: 表示速度のしきい値](./0017-display-speed-thresholds.md)
- [Google Testing Blog: Test Sizes](https://testing.googleblog.com/2010/12/test-sizes.html)
- [DORA: Test Automation](https://dora.dev/capabilities/test-automation/)
- [Google SRE Book: Testing for Reliability](https://sre.google/sre-book/testing-reliability/)
- [Nielsen Norman Group: Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [Cloudflare: Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Cloudflare: Test harness](https://developers.cloudflare.com/workers/testing/test-harness/)
