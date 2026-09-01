---
# These are optional metadata elements. Feel free to remove any of them.
status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123}"
date: {YYYY-MM-DD when the decision was last updated}
# Added by synsk: decision-makers には決めた者を書く。起案した者が別なら consulted に書く。
decision-makers: {list everyone involved in the decision}
consulted: {list everyone whose opinions are sought (typically subject-matter experts); and with whom there is a two-way communication}
informed: {list everyone who is kept up-to-date on progress; and with whom there is a one-way communication}
---

# {short title, representative of solved problem and found solution}

<!-- Added by synsk: 見出しに番号を書かない。番号はファイル名が持つ。
     他文書からは ADR-NNNN で参照する。
     このテンプレートにない小見出しを足してよい。制約するのは MADR が定める節だけ。 -->

## Context and Problem Statement

<!-- Added by synsk: 調べて分かった事実を書く。他文書の表を転記しない。
     転記の過程で未決が決定に格上げされるため。
     書いてよい: Medium の RSS には rel="canonical" が含まれない（2026-08-20 に実フィードを取得して確認）
     書かない: （他文書の表をそのまま転記） -->

{Describe the context and problem statement, e.g., in free form using two to three sentences or in the form of an illustrative story. You may want to articulate the problem in form of a question. Consider adding links to collaboration boards or issue management systems. Make the scope of the decision explicit, for instance, by calling out or pointing at structural architecture elements (components, connectors, ...).}

<!-- This is an optional element. Feel free to remove. -->
## Decision Drivers

<!-- Added by synsk: 該当する原則があればアンカー付きリンクで1行目に置く。
     書いてよい: * 実験 over 完璧な計画（[PRINCIPLES.md](../PRINCIPLES.md#2-実験)）
     書かない: * [PRINCIPLES.md](../PRINCIPLES.md) → どの原則が効いたか読めない -->
* {decision driver 1, for instance, a desired software quality, faced concern, constraint or force}
* {decision driver 2}
* … <!-- numbers of drivers can vary -->

## Considered Options

* {title of option 1}
* {title of option 2}
* {title of option 3}
* … <!-- numbers of options can vary -->

## Decision Outcome

<!-- Added by synsk: 何をどうするかを書く。文書の存在告知にしない。
     書いてよい: 外部プラットフォームへの転載は synsk.me を正本とする（POSSE）
     書かない: VISION.md と PRINCIPLES.md を定義する → プロジェクトの進み方に影響しない -->
Chosen option: "{title of option 1}", because {justification. e.g., only option, which meets k.o. criterion decision driver | which resolves force {force} | … | comes out best (see below)}.

<!-- This is an optional element. Feel free to remove. -->
### Consequences

<!-- Added by synsk: 「決めていない」と書けるのは、その決定の帰結として生じた
     不確実性に限る。その記録で決めるべきだったことは Issue が持つ。
     書いてよい: Bad, because 版の粒度を決めていない。保存のたびに版を作るのか、公開のたびに作るのかで、保管量が桁違いになる
     書かない: Bad, because この記録ではデータ形式を確定していない → Issue が持つ -->
* Good, because {positive consequence, e.g., improvement of one or more desired qualities, …}
* Bad, because {negative consequence, e.g., compromising one or more desired qualities, …}
* … <!-- numbers of consequences can vary -->

### Confirmation

<!-- Added by synsk: 常に書く。判定手段がなければ、ないことと理由を書く。節ごと消さない。
     理由は「思いつかなかった」で足りる。考えた結果ないことと、考えていないことを分けるため。
     書いてよい: `check.sh` の [参照の向き] 検査が、変わりにくい側から変わりやすい側へのリンクを検出する
     書いてよい: 判定手段がない。「軸を定めない」ことを確認する方法が思いつかなかった
     書かない: 実装時に注意する → 判定していない -->

{Describe how the implementation / compliance of the ADR can/will be confirmed. Is there any automated or manual fitness function? If so, list it and explain how it is applied. Is the chosen design and its implementation in line with the decision? E.g., a design/code review or a test with a library such as ArchUnit can help validate this.}

<!-- This is an optional element. Feel free to remove. -->
## Pros and Cons of the Options

### {title of option 1}

<!-- This is an optional element. Feel free to remove. -->
{example | description | pointer to more information | …}

* Good, because {argument a}
* Good, because {argument b}
<!-- use "neutral" if the given argument weights neither for good nor bad -->
* Neutral, because {argument c}
* Bad, because {argument d}
* … <!-- numbers of pros and cons can vary -->

### {title of other option}

{example | description | pointer to more information | …}

* Good, because {argument a}
* Neutral, because {argument b}
* Bad, because {argument c}
* …

<!-- This is an optional element. Feel free to remove. -->
## More Information

{You might want to provide additional evidence/confidence for the decision outcome here and/or document the team agreement on the decision and/or define when/how this decision the decision should be realized and if/when it should be re-visited. Links to other decisions and resources might appear here as well.}
