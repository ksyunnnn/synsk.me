---
status: accepted
date: 2026-09-28
decision-makers: synsk
consulted: Claude
---

# デザインガイドラインの層を Apple の Human Interface Guidelines に倣い、5 つ持つ

## Context and Problem Statement

デザインガイドラインは、デザインを構成する層ごとに、その役割と置き場を書く文書である。各層の中身は書かず、各層の置き場が持つ。キービジュアルと UI の両方に使う。

Apple の Human Interface Guidelines（以下 HIG）は、Getting started / Foundations / Patterns / Components / Inputs / Technologies の 6 つの層を持つ（2026-09-13 に確認）。Getting started はプラットフォームごとの設計（Designing for iOS など 8 項目）を含み、Foundations は Immersive experiences や SF Symbols のように Apple のプラットフォーム専用の項目を含む。

HIG の Designing for iPhone Duo は、Web・Safari・WebKit に触れず、実装の手段としてアプリ向けの API（ReservedRegion、size classes、safe area insets）だけを挙げる。Web のページから扱える手段は次のとおりである（2026-09-24 に公式の仕様と MDN の互換データで確認）。

- 画面の大きさの変化: resize とメディアクエリで受け取れる
- 安全領域: `viewport-fit=cover` と `env(safe-area-inset-*)`。iOS 11 以降の Safari が対応する。仕様上、安全領域は四辺からの距離で表す長方形 1 つである
- 折り目: Viewport Segments は Chromium だけが提供し、Safari は対応しない
- 開閉の状態: Device Posture API は Chromium だけが既定で提供する。Safari が提供するという Apple の公式情報はない

## Decision Drivers

* 実験 over 完璧な計画（[PRINCIPLES.md](../PRINCIPLES.md#2-実験)）

## Considered Options

* HIG に倣う

## Decision Outcome

Chosen option: "HIG に倣う"。比べた候補はない。synsk の記憶では、理由は次の 2 つである。

1. iPhone Duo という新しい端末に合わせた画面設計を大事にしたい
2. apple.com の製品ページに影響を受けた

### 持つ層

**Getting started / Foundations / Patterns / Components / Inputs の 5 つを持つ。Technologies は持たない。**

外す項目と理由は次のとおりである。

| 外す項目 | 理由 |
|---|---|
| Technologies の層 | アプリ向けの技術か、Apple の製品に固有の技術を扱う層であるため |
| Getting started のプラットフォームごとの 8 項目（Designing for iOS 〜 Designing for iPhone Duo） | 同上 |
| Immersive experiences / Spatial layout | visionOS と Apple Vision Pro 専用 |
| SF Symbols | Apple のプラットフォームのアプリ向けのアイコン集 |
| Right to left | 右から左に読む言語を扱わない |

外した Technologies の層のうち、VoiceOver は Foundations の Accessibility で、Generative AI は Patterns の Feedback の下の「AI を使っている場所を知らせる」で扱う。Sign in with Apple は、ログイン画面の見た目を作れないため扱わない（ADR-0013）。Apple Pay と Maps は、使う予定がないため扱わない。

Designing for iOS・iPadOS・macOS・visionOS と Designing for iPhone Duo のうち、端末をまたいで成り立つ観点は Foundations の Layout で扱う。Web から扱えるのは大きさの変化と安全領域までで、折り目と開閉の状態は 2026-09-24 時点の Safari から取れない。

### HIG で表せないもの

**HIG の項目で表せないものは、他のデザインガイドラインの項目から足す。**

Branding の下に足した Key visual / Logos / Illustrations は、層にせず、Foundations の項目にする（2026-09-18）。HIG は Branding を Foundations に置き、Atlassian も Logos と Illustrations を Foundations の項目にしているため。

足した項目とその置き場は `design/guidelines.md` が持つ。

### Shape

**Shape は 1 つの項目にせず、役割ごとに 4 か所に分ける。**

Material 3 の Shape は、役割を 3 つ挙げる。

> Shape can direct attention, communicate state, and express brand.

この 3 つと、角の丸みの段階の値（shape scale）を、目次にある項目へ振り分ける。

| 役割 | 置き場 |
|---|---|
| ブランドを表す | Foundations の Branding |
| 注意を向ける | Foundations の Layout（HIG の Layout に Visual hierarchy の節がある） |
| 状態を伝える | Patterns の Feedback（HIG の Feedback は何が起きているかを知らせるページ） |
| 角の丸みの段階の値 | Foundations の Design tokens |

### AI

**AI は独立した項目にせず、Patterns の Feedback の下に「AI を使っている場所を知らせる」を置く（2026-09-18）。**

- synsk.me に生成 AI の機能を作る予定がない。HIG の Generative AI も Carbon for AI も、AI の機能を持つプロダクト向けの項目である
- 扱いたいのは AI を使っている場所を知らせることで、HIG の Generative AI の Transparency の節「Communicate where your app uses AI」に当たる
- 知らせるかどうかの方針そのものは見た目の話ではないため、ガイドラインの外で決める

### Consequences

* Bad, because HIG はアプリ向けの手段を前提とし、そのうち折り目と開閉の状態は 2026-09-24 時点の Safari から扱えない

### Confirmation

`design/guidelines.md` の目次の最上位の項目が 5 つの層と一致しているかを、目で見て確かめる。足した項目に出典が書かれているかも、目で見て確かめる。機械的に判定する手段は思いつかなかった。

## More Information

HIG

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)

足した項目の出典

- [Atlassian Foundations](https://atlassian.design/foundations)
- [Material 3 Styles](https://m3.material.io/styles)
- [Material 3 Shape](https://m3.material.io/styles/shape)
- [Carbon for AI](https://carbondesignsystem.com/guidelines/carbon-for-ai/)
- [Fluent 2 Layout](https://fluent2.microsoft.design/layout)
- [Pajamas Brand introduction](https://design.gitlab.com/brand-introduction)

Web から扱える手段の出典（2026-09-24 に取得）

- [CSS Environment Variables Module Level 1](https://www.w3.org/TR/css-env-1/)
- [Device Posture API](https://www.w3.org/TR/device-posture/)
- [MDN browser-compat-data: env()](https://github.com/mdn/browser-compat-data/blob/main/css/types/env.json)
- [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)

関連する決定の記録

- [ADR-0026: コードの構成に ADOP を使う](./0026-code-structure-adop.md)
