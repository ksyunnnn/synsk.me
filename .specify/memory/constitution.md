<!--
Sync Impact Report
- Version change: (未記入のテンプレート) → 1.0.0
- Modified principles: なし（初回の記入）
- Added sections: Core Principles（4つ）、Governance
- Removed sections: [SECTION_2_NAME]、[SECTION_3_NAME]
  技術スタックの制約と作業手順は docs/decisions/ と CLAUDE.md が持つ。
  転記するとどちらかが古くなるため、節ごと置かない。
- Templates requiring updates:
  - .specify/templates/plan-template.md の `## Constitution Check` は
    `[Gates determined based on constitution file]` のままでよい。ゲートの中身は
    この文書から都度導く。
- Follow-up TODOs: なし
-->

# synsk.me Constitution

## Core Principles

### I. Test Layering

テストを単体・workerd・結合・E2E の4段階に分ける。PR の CI は 10 分以内に収める。

段階ごとに確かめる対象が違う。単体はソースの静的検査、workerd は binding の配管、
結合は経路と応答、E2E は実ブラウザでしかわからないふるまいを持つ。同じことを
2つの段階で確かめない。

根拠: ADR-0019

### II. Display Speed

表示速度は LCP 2,500ms・INP 200ms・CLS 0.1・TTFB 800ms・FCP 1,800ms を、
モバイルとデスクトップそれぞれの 75 パーセンタイルで満たす。

根拠: ADR-0017、`docs/REQUIREMENTS.md` の NFR-03〜NFR-07

### III. Cacheability

すべての `page.tsx` は正の `export const revalidate` を持つ。

落とすと dynamic として扱われ、エッジのキャッシュに載らない。
`tests/unit/cacheability.test.ts` が `src/app` を走査して機械的に検査する。

根拠: ADR-0018

### IV. Allowlist Visibility

公開できない値の選別は許可リスト方式で行う。出力する場所で、出す項目を列挙する。

除外リスト方式はカラムが増えたときに漏れる。許可リスト方式であれば、
新しいカラムは既定で公開されない。

根拠: ADR-0008、ADR-0014

## Governance

この文書は `/speckit-plan` が Constitution Check で読む。原則に反する計画は
通さない。反したまま進める場合は `plan.md` の `## Complexity Tracking` に
理由と、退けたより単純な代替案を書く。

原則の根拠は `docs/decisions/` が持つ。ここには根拠を転記せず、ID で参照する。
根拠となる記録が superseded になったとき、この文書の該当する原則を見直す。

修正は `/speckit-constitution` による。手で書き換えない。版は semver で付ける。
原則の削除と再定義は MAJOR、原則と節の追加は MINOR、字句の修正は PATCH とする。

**Version**: 1.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
