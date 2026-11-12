---
status: accepted
date: 2026-11-12
decision-makers: synsk
consulted: Claude Code
---

# 実績の種類を、オーナーが何をしたかの1軸で分ける

## Context and Problem Statement

実績の種類（`project.kind` と、職務経歴書に写した `resume_project.kind`）は、`application`（アプリ）・`talk`（登壇）・`event`（イベント）・`other`（その他）の4値だった。4値は issue #72 で決まった（[2026-10-19 の合意](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6263128728)、[2026-10-26 の決定](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6410577691)）。合意の根拠は JSON Resume の `projects.type` と同じ形にすることで、4値をどの基準で分けるかは書かれていない。

4値は、分ける特性が値ごとに違う。`application` は作ったもの、`talk` はオーナーがした行為、`event` は催しの形で分けている。そのため、勉強会を開いてそのためのアプリを作った実績は、`application` にも `event` にも入りうる。

分類の原則として、次の出典を 2026-11-12 に本文で確かめた。

- Ranganathan, *Prolegomena to Library Classification*（1937）の Canon of Exclusiveness は「The classes in an array of classes should be mutually exclusive.」とし、その条件は「the classes of an array are to be derived from its immediate universe on the basis of a single characteristic」なら自動で満たされるとする（p.41）。Canon of Exhaustiveness は「The classes in any array of classes should be totally exhaustive of their common immediate universe.」とする（p.40）
- ISKO Encyclopedia の Facet analysis は、論理的区分の原則として「Only one characteristic of division should be applied at a time」と「Division should be exhaustive」を挙げる

2026-11-12 に手元の D1（seed を入れた状態）で数えると、実績は `application` 18 件、`event` 3 件、`other` 2 件、`talk` 1 件だった。`event` の 3 件はどれもオーナーが催しを開いたもので、`application` の 18 件はどれもオーナーが開発したものだった。

この記録は、ADR-0043 と ADR-0044 と ADR-0046 を変えない。3つの記録は種類を `project.kind` で持つことを決め、値の一覧は持たない。

## Decision Drivers

* 1つの段は1つの特性で分け、値どうしが重ならず、漏れがない（Ranganathan の Canon of Exclusiveness と Canon of Exhaustiveness）
* 値の名前と意味を揃える（[SOFTWARE_DESIGN.md の「列の名前を意味ごとに1つにする」](../SOFTWARE_DESIGN.md#列の名前を意味ごとに1つにする)）
* 業務か個人開発かは、実績が指す組織が持つ。種類にその区別を重ねない

## Considered Options

* 旧の4値のまま（アプリ・登壇・イベント・その他）
* 何をしたかの4値（開発・主催・登壇・その他）
* 何をしたかの4値に、重なったときの決まりを足す
* 残ったものの形で分ける（プロダクト・催し・発表・その他）
* 1件の実績に1つの行為とし、主催と登壇を別の実績で登録する
* 軸を2つに分ける（種類は形、行為は複数選べる別の欄）

## Decision Outcome

Chosen option: "何をしたかの4値（開発・主催・登壇・その他）", because 1つの特性で分けられ、2026-11-12 の時点の実績のどれも1つの値に収まるため。オーナーが 2026-11-12 に決めた（issue #334）。

- 種類は、オーナーがその実績で何をしたかで分ける。値と表示名は `develop`（開発）・`host`（主催）・`talk`（登壇）・`other`（その他）。入力の選択肢はこの順
- 既にある行は `application` を `develop` に、`event` を `host` に移す。`talk` と `other` はそのまま
- 表示名だけでなく、表に入れる値も変える。`application`（作ったもの）という値が「開発」（したこと）を指すと、名前と意味がずれるため
- 1件の実績が2つの行為にまたがるとき（例: 自分で開いた勉強会で登壇した）の決まりは置かない。2026-11-12 の時点の実績に、またがるものは無いため

### Consequences

* Good, because どの値も「何をしたか」の1つの特性で決まり、1件の実績が2つの値に入らない
* Good, because 値の名前と表示名が同じ意味を指す
* Bad, because 1件の実績が2つの行為にまたがったとき、どちらの値にするかの決まりが無い。またがる実績を登録するときに決める
* Bad, because 表に入れる値を変えるため、`project` と `resume_project` を作り直す migration が要る

### Confirmation

- `project.kind` と `resume_project.kind` の CHECK が4値だけを許す（`migrations/0028_change_project_kind_to_act.sql`）
- `tests/workers/migration-0028-rows.test.ts` が、0028 で `application` が `develop` に、`event` が `host` に移ることを確かめる
- `tests/unit/project-domain.test.ts` が、`PROJECT_KINDS` の値と順を確かめる

## Pros and Cons of the Options

### 旧の4値のまま（アプリ・登壇・イベント・その他）

* Good, because 表と値を変えずに済む
* Bad, because 作ったもの・行為・催しの形の3つの特性が混ざり、1件の実績が2つの値に入りうる

### 何をしたかの4値（開発・主催・登壇・その他） — 採用

* Good, because 1つの特性で分かれる
* Good, because 表の形は変えず、値の移し替えだけで済む
* Bad, because 主催と登壇は1件の実績の中で重なりうる。2026-11-12 の時点の実績には重なりが無い

### 何をしたかの4値に、重なったときの決まりを足す

例: 主催と登壇が重なったら主催にする。

* Good, because 重なったときにも値が1つに決まる
* Bad, because 2026-11-12 の時点で当てはまる実績が無い決まりを先に置く

### 残ったものの形で分ける（プロダクト・催し・発表・その他）

* Good, because 1つの特性で分かれる
* Bad, because 発表は催しの中で行われることが多く、自分で開いた催しで話した実績の境目が曖昧になる

### 1件の実績に1つの行為とし、主催と登壇を別の実績で登録する

* Good, because 値が必ず1つに決まり、決まりを置かずに済む
* Bad, because 1つの出来事を2件で登録する手間が増え、一覧に同じ出来事が2回出る

### 軸を2つに分ける（種類は形、行為は複数選べる別の欄）

ISKO Encyclopedia の Facet analysis が述べる、特性ごとに欄を分ける考え方。

* Good, because 1件の実績が複数の行為を持てて、重なりを決まりなしで表せる
* Bad, because 欄と表が1つずつ増え、入力・表示・検査が増える。2026-11-12 の時点の実績には重なりが無い

## More Information

- [S. R. Ranganathan, Prolegomena to Library Classification（1937）](https://archive.org/details/in.ernet.dli.2015.281864)。p.40–41
- [ISKO Encyclopedia of Knowledge Organization: Facet analysis](https://isko.org/cyclo/facet_analysis)
- [issue #72 の 2026-10-19 の合意](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6263128728)。旧の4値と、JSON Resume の `projects.type` に倣った根拠
