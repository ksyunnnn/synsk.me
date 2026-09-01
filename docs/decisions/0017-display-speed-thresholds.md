---
status: accepted
date: 2026-09-01
decision-makers: synsk
---

# 表示速度の指標と閾値

## Context and Problem Statement

`docs/PRINCIPLES.md` は「余白 over 密度」と「息づき over 装飾」を定めるが、表示速度との優先順位を定めていなかった。`docs/REQUIREMENTS.md` の NFR も表示速度を扱っていなかった。表示速度と見た目・動き・機能が競合したとき、どちらを取るかを判断する記述が存在しなかった。

指標の体系は Web に固有のものが1つある。[web.dev: user-centric performance metrics](https://web.dev/articles/user-centric-performance-metrics) が指標を「Objective criteria that can be quantitatively measured」と定義し、FCP・LCP・INP・TBT・CLS・TTFB の6つを挙げる。同記事は「no single metric is sufficient to capture all the performance characteristics of a page」と述べる。

この体系は閾値の判定方法も定める。

> a good threshold to measure is the 75th percentile of page loads, segmented across mobile and desktop devices

75パーセンタイルは、ページの読み込みを速い順に並べたときの、下から75%の位置にある値を指す。4回の訪問のうち3回はその値より速い、という状態を表す。平均を使わないのは、極端に遅い訪問に引きずられたり、速い多数に隠されたりするためである。

この体系は Google が定めたものであり、次の制約を持つ。閾値は他のブラウザベンダと標準化団体が承認していない。判定に使う CrUX は Chrome のデータのみで、対応プラットフォームはデスクトップ版 Chrome と Android 版 Chrome に限られる。[Interop 2026](https://github.com/web-platform-tests/interop/blob/main/2026/README.md) の focus areas 20件と investigation efforts 4件に、表示速度の指標は含まれない。測定 API 自体は W3C Web Performance Working Group の仕様であり、Safari 26.2（2025-12-12）が Event Timing API と Largest Contentful Paint を実装している。

`synsk.me` は CrUX にデータを持たない。PageSpeed Insights が No Data を返す（2026-08-29 確認）。CrUX は「sufficiently popular」であることを条件とし、閾値は非公開である。

閾値の参考として、作り手が速いと判断したサイトを CrUX API で実測した。集計終了日 2026-08-30、75パーセンタイル。

| 指標 | catnose.me モバイル | zenn.dev モバイル | web.dev の good |
|---|---|---|---|
| LCP | 1,120ms | 1,057ms | 2,500ms |
| INP | 115ms | 73ms | 200ms |
| CLS | 0.00 | 0.00 | 0.1 |
| TTFB | 432ms | 443ms | 800ms |
| FCP | 874ms | 1,014ms | 1,800ms |

2サイトとも全指標で good を下回る。

## Decision Drivers

* [余白 over 密度](../PRINCIPLES.md#1-余白-1)
* [息づき over 装飾](../PRINCIPLES.md#2-息づき)
* 表現を優先したい。速度が表現に優先する場面を限定する
* 実ユーザーのデータで検証できること

## Considered Options

### 採る指標

* Core Web Vitals の3指標（LCP・INP・CLS）
* 5指標（LCP・INP・CLS・TTFB・FCP）
* 6指標すべて（TBT を含む）
* Lighthouse の Performance スコア

### 閾値

* web.dev の good の閾値をそのまま採る
* 実測から独自の値を定める
* 満たすべき値と目標値の2水準を持つ

## Decision Outcome

**表示速度の指標を5つとし、満たすべき値と目標値の2水準で定める。**

| 指標 | 満たすべき値 | 目標値 |
|---|---|---|
| LCP | 2,500ms | 1,100ms |
| INP | 200ms | 75ms |
| CLS | 0.1 | 0 |
| TTFB | 800ms | 450ms |
| FCP | 1,800ms | 900ms |

満たすべき値は web.dev が定める good の閾値である。目標値は catnose.me と zenn.dev の実測値を上回る最小値である。

判定はモバイルとデスクトップそれぞれの75パーセンタイルで行う。

対象は訪問者が到達する経路とする。`/dash/` 配下は作り手のみが使うため外れる。歴代サイトは年ごとのサブドメインに置かれ、別ホストになるため外れる（[ADR-0016](./0016-url-conventions.md)）。

満たすべき値を割ったとき、表示速度が見た目・動き・機能に優先する。目標値を割った状態では優先しない。

TBT を採らないのは、[Web Vitals](https://web.dev/articles/vitals) が TBT についてのみ次を述べるためである。

> it is not part of the Core Web Vitals set because they are not field-measurable, nor do they reflect a user-centric outcome

TBT は同記事が「vital in catching and diagnosing potential interactivity issues that can impact INP」と述べる用途で使う。

記法は Planguage（[Using Planguage for specifying requirements](https://www.malotaux.eu/?id=planguage)）の Tolerable と Goal に対応する。

> Tolerable: If we don't achieve this level, the project fails.
> Goal: This is the level we expect to achieve in this project. When we have achieved it, we are done.

### Consequences

* Good, because 実ユーザーのデータで5指標すべてを検証できる
* Good, because 満たすべき値と目標値の幅が、表現との調整の余地になる
* Good, because CLS は AI エージェントの操作にも効く。[Lighthouse agentic browsing scoring](https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring) が「Measures visual stability, which is critical for agents relying on element positioning」と述べる
* Bad, because 満たすべき値が Google の定義に依存する。同社が値を変えれば追随することになる
* Bad, because 目標値の出所が2サイトの2026-08-30 時点の実測であり、その後の変化を反映しない
* Bad, because CrUX にデータがないため、Chrome の集計では検証できない。実ユーザーのデータを得る手段を別に用意することになる

### Confirmation

CrUX API と Cloudflare の Web Analytics が、モバイルとデスクトップそれぞれの75パーセンタイルで5指標を返す。返された値を満たすべき値と突き合わせる。

`synsk.me` は CrUX にデータを持たないため、この手段は Cloudflare の Web Analytics で beacon を配信した後に成立する。

## Pros and Cons of the Options

### Core Web Vitals の3指標

* Good, because 検索順位に使われる指標と一致する
* Good, because 守るべき数値が3つに収まる
* Bad, because LCP が遅いときの原因を切り分ける指標が基準に含まれない

### 5指標 — 採用

* Good, because TTFB と FCP が LCP の切り分けに使える。web.dev は両者を supplemental metrics と位置づける
* Good, because 5指標すべてが実ユーザーのデータで測れる
* Bad, because 守るべき数値が5つに増える

### 6指標すべて

* Good, because Lighthouse が出力する主要な指標を網羅する
* Bad, because TBT が実ユーザーのデータで検証できない項目として残る

### Lighthouse の Performance スコア

* Good, because 単一の数値で表せる
* Bad, because 内訳の重み（TBT 30%、LCP 25%、CLS 25%、FCP 10%、Speed Index 10%）に判断を委ねることになる
* Bad, because ラボ計測でしか得られない

### web.dev の good の閾値をそのまま採る

* Good, because 外部のツールが同じ値で判定する。Cloudflare の Web Analytics は「based on the thresholds defined by Google」で Good / Needs Improvement / Poor を判定する
* Bad, because 目標として弱い。実測した2サイトはいずれも good を大きく下回る

### 実測から独自の値を定める

* Good, because 実際に速いと感じる水準を基準にできる
* Bad, because 外部のツールの判定と食い違う
* Bad, because 割ったときに表示速度が優先されるため、表現を優先したい意向と合わない

### 満たすべき値と目標値の2水準を持つ — 採用

* Good, because 外部のツールとの整合と、目指す水準の両方を持てる
* Good, because 速度が表現に優先する場面を、満たすべき値を割ったときに限定できる
* Bad, because 要件の記述が長くなる
