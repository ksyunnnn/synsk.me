---
status: accepted
date: 2026-10-27
decision-makers: synsk
consulted: Claude Code
---

# 職歴と実績は組織を指し、一覧は元の表をつないで読む

## Context and Problem Statement

[ADR-0003](./0003-content-data-model.md) は、Activity → Project → Career の参照方向と、「Project 自体はタイムラインに表示しない」を決めた。ADR-0003 は Activity を「外部プラットフォームから取得するコンテンツ（GitHub リポジトリ、Zenn 記事、イベント参加など）」としている。

次の要求と事実は、この定義と参照方向に合わない。

- synsk.me の中で作る life event（人生の出来事の 1 件）も、一覧に並べる
- 1 つの組織に、職歴も実績も複数つく。職歴がなく、実績だけがつく組織もある
- 実績には、仕事・企画のほかに、勉強会の開催や登壇などの活動も入る
- 実績と職歴も、一覧に 1 行ずつ並べる
- note と project は同じ DB の中に元の行を持つ。一覧のために activity へ写すと、元を直したときに写しが古くなりうる

## Decision Drivers

* 同じ値を 2 か所に持たない。2 か所に持つと、片方を直したときにもう片方が古くなる

## Considered Options

* ADR-0003 の参照方向を保つ（Activity → Project → Career）
* 職歴と実績が組織を指し、一覧のために note・project・career を activity に写す
* 職歴と実績が組織を指し、一覧は元の表を UNION ALL のビューでつないで読む
* 職歴と実績が組織を指し、一覧に並ぶ種類に共通の親の表を持たせる

## Decision Outcome

Chosen option: "職歴と実績が組織を指し、一覧は元の表を UNION ALL のビューでつないで読む", because 元が同じ DB の中にある note・project・career は、写さずに元を読めるため。写せば、元を直したときに写しが古くなりうる。

### 表と関係

- organization（組織）: 所属した組織。会社・団体・自営業（個人）を含む。個人開発は、自営業（個人）の organization の 1 行で表す
- career（職歴）: 組織にオーナーが所属して働いた履歴。organization を 1 つ必ず指す
- project（実績）: いずれかの組織で実際に担当した仕事・企画と、活動（勉強会の開催・登壇など）。organization を 1 つ必ず指す。種類は project.kind で分ける
- career と project は直接つながらない。職歴のスキルと、職歴ごとの実績は、同じ組織で期間が重なる実績から求める
- activity: 外部の取得元から取った項目と、life event だけを持つ。note・project・career は activity に行を持たない
- project.is_highlighted で選んだ実績を、ハイライトとして表示する

### 一覧

- 一覧は、activity・note・project・career を UNION ALL でつなぐビュー（activity_feed）で読む。公開側はこのビューだけを読む
- 公開中の note だけを出す決まりと、is_masked の project と career を秘匿化した値で出す決まりは、ビューの中に書く
- 並びの日付は、それぞれの表の元の列を使う。project と career は started_on を使う
- 並べるキーは (日付, 種類, id)。表ごとに id が重なるため

### Consequences

* Good, because note・project・career を直しても、一覧の行が古くならない。保存のときに書くのは元の 1 行だけ
* Good, because 組織名と秘匿化した組織名を organization に 1 つだけ持つ。同じ組織の表記がぶれない。組織名を直すと、それを指す職歴と実績に反映する
* Bad, because 一覧を読む速さが D1 で確かめられていない。手元の SQLite（3.51.0、作り物のデータ）では速かったが、ビューの各腕の式の affinity が揃わないと全行を読む（[SQLite: Query Flattening](https://www.sqlite.org/optoverview.html#subquery_flattening)）
* Bad, because 外部の取得元から取った activity は、元が DB の外にあるので写して持つしかない。取得元で直された値が古くなる危険は残る

### Confirmation

一覧を実装するときに、D1 で一覧の読み取り行数（`meta.rows_read`）を測る。遅ければ、写す形に移す。

project から career への外部キーがないこと、activity が note・project・career を指す列を持たないことは、`migrations/` の CREATE TABLE で確かめられる。

## Pros and Cons of the Options

### ADR-0003 の参照方向を保つ（Activity → Project → Career）

* Good, because 職歴・実績・成果物の階層が、そのまま職務経歴書の階層になる
* Bad, because 組織名と秘匿化した組織名を実績ごとに持つ（ADR-0003 の `client`・`clientPublic`）。同じ組織の名前が実績の数だけ重なり、表記がぶれる
* Bad, because Activity を外部から取得するコンテンツとするので、life event が入らない

### 職歴と実績が組織を指し、一覧のために note・project・career を activity に写す

* Good, because 一覧を 1 つの表と 1 つの索引で読むので、D1 でも速い
* Bad, because note・project・career を保存する箇所ごとに、元と写しの 2 行を書く。書き忘れると、一覧の行が古くなる
* Bad, because 物理削除のとき、note・project・career の子に activity の行が加わる

### 職歴と実績が組織を指し、一覧に並ぶ種類に共通の親の表を持たせる

* Good, because 写しを持たない
* Bad, because 外部キーに連れて削除（CASCADE）があると、親の表を作り直したときに子の note・project の全行が消える（[SQLite: DROP TABLE](https://www.sqlite.org/lang_droptable.html)）

## More Information

この記録は [ADR-0003](./0003-content-data-model.md) を置き換える。ADR-0003 から切り出した公開設定は [ADR-0008](./0008-content-visibility.md) が持ち、この記録は扱わない。
