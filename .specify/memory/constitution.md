<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles:
  - I. Test Layering → Decided Constraints の「Test Layering」へ移した
  - II. Display Speed → Decided Constraints の「Display Speed」へ移した。
    閾値の数値を転記せず、NFR-03〜NFR-07 の ID で参照する形に再定義した
  - III. Cacheability → Decided Constraints の「Cacheability」へ移した
  - IV. Allowlist Visibility → Decided Constraints の「Allowlist Visibility」へ移した
- Added principles（Core Principles を docs/SOFTWARE_DESIGN.md の設計原則 1〜9 から導いた）:
  - I. Protected Values
  - II. Stop on Missing Input
  - III. Verified Scope
  - IV. Partial Availability
  - V. Accessible Controls
  - VI. Measure Before Optimizing
  - VII. Boundary Translation
  - VIII. Portable Core
  - IX. Simplicity
- Added sections: Decided Constraints（テンプレートの [SECTION_2_NAME]）
- Removed sections: [SECTION_3_NAME]。作業手順は CLAUDE.md が持つため置かない
- Templates requiring updates:
  - .specify/templates/plan-template.md の `## Constitution Check` は
    `[Gates determined based on constitution file]` のままでよい。ゲートの中身は
    この文書から導く
- Follow-up TODOs: なし
-->

# synsk.me Constitution

## Core Principles

各原則は `docs/SOFTWARE_DESIGN.md` の設計原則を、`plan.md` で判定できる形にしたものである。
見出しの後の「出典」が、対応する設計原則の番号を示す。

### I. Protected Values

- 公開できない値を訪問者へ出す経路を持たない。
- 作り手だけが変えられるデータへの書き込み経路を足す plan は、
  作り手以外がその経路を通れないことを確かめる検査を書く。

出典: 設計原則 1

### II. Stop on Missing Input

- 公開・外への発信・費用のかかる処理は、判断に必要な値が欠けたときに実行しない。
- これらの処理を足す plan は、量と回数の上限の値を書く。

出典: 設計原則 2

### III. Verified Scope

- 機能が満たすべきことの1つ1つに、それを確かめる検査を対応させる。
- 検査を対応させられない項目は、その機能の範囲から外す。

出典: 設計原則 3

### IV. Partial Availability

- 複数の取得元や処理を持つ画面は、1つの失敗で全体を失敗にしない。成り立つ部分を表示・処理する。
- 画面は `docs/REQUIREMENTS.md` の NFR-02 が挙げる各状態で成立する。

出典: 設計原則 4

### V. Accessible Controls

- 操作できる部品は、キーボードだけ・読み上げ・スマートフォンのそれぞれで、同じ操作ができる。

出典: 設計原則 5

### VI. Measure Before Optimizing

- 速さや資源の使い方のために分かりやすさを削る変更は、閾値を割った計測値を plan に書く。
- 計測値のない最適化を plan に含めない。

出典: 設計原則 6

### VII. Boundary Translation

- 外部サービスから受け取ったデータは、受け取ったモジュールの中で synsk.me の型に変換する。
- 外部サービスの型を、受け取ったモジュールの外で使わない。

出典: 設計原則 7

### VIII. Portable Core

- 配信先とデータの置き場に固有の機能は、それを閉じ込めるモジュールの中だけで使う。
- 固有の機能を使う plan は、使う箇所と、閉じ込めるモジュールを書く。

出典: 設計原則 8

### IX. Simplicity

- 包む・層・インタフェース・共通化を足す plan は、差し替えか2つ目の使い道を、具体的な対象の名前で書く。
- 書けないものは足さない。

出典: 設計原則 9

## Decided Constraints

決定の記録で決めた、数値や対象が特定された制約を置く。

### Test Layering

テストを単体・workerd・結合・E2E の4段階に分ける。PR の CI は 10 分以内に収める。
同じことを2つの段階で確かめない。

根拠: ADR-0019

### Display Speed

訪問者が到達する経路は、`docs/REQUIREMENTS.md` の NFR-03〜NFR-07 の閾値を満たす。

根拠: ADR-0017

### Cacheability

すべての `page.tsx` は正の `export const revalidate` を持つ。
`tests/unit/cacheability.test.ts` が `src/app` を走査して検査する。

根拠: ADR-0018

### Allowlist Visibility

公開できない値の選別は許可リスト方式で行う。出力する場所で、出す項目を列挙する。

根拠: ADR-0008、ADR-0014

## Governance

この文書は `/speckit-plan` が Constitution Check で読む。原則と制約に反する計画は
通さない。反したまま進める場合は `plan.md` の `## Complexity Tracking` に
理由と、退けたより単純な代替案を書く。

Core Principles の出典は `docs/SOFTWARE_DESIGN.md` の設計原則が持つ。
原則どうしがぶつかったときの扱いは、この文書に書かず、設計原則の側に従う。
設計原則が変わったとき、対応する原則を見直す。

Decided Constraints の根拠は `docs/decisions/` が持つ。根拠を転記せず、ID で参照する。
根拠となる記録が superseded になったとき、該当する制約を見直す。

修正は `/speckit-constitution` による。手で書き換えない。版は semver で付ける。
原則の削除と再定義は MAJOR、原則と節の追加は MINOR、字句の修正は PATCH とする。

**Version**: 2.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-16
