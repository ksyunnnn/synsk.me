---
status: proposed
date: 2026-11-09
decision-makers: synsk
consulted: Claude Code
---

# 外部の activity は取得元の状態に従い、手で付ける値を持たない。URL を登録した activity と手で入力した activity は synsk.me の側で削除できる

## Context and Problem Statement

[ADR-0045](./0045-external-activity-follows-source.md) は、外部の activity が取得元の状態に従い、手で付ける値を持たないと決めた。Decision Outcome の 1 行に「外部の activity を隠したいときは、オーナーが外部のサービス側で非公開にする」がある。

`specs/004-external-activity/spec.md` は、次のように定める。

- オーナーは、URL を指名して登録した activity と手で入力して登録した activity を、synsk.me の側で削除できる。サーバーから取れない取得元では取得元で消えたことを確かめられず、ほかに一覧から消える経路が無いため（FR-033）
- オーナーが外部の activity を一覧に出したくないときは、外部のサービス側で非公開にする。synsk.me の側に 1 件ずつ隠す操作を持たない（FR-022）
- 外部の activity に、オーナーが手で付ける値（コメント・分類の上書き・非公開への切り替え）を持たない（FR-021）

ADR-0045 の「外部のサービス側で非公開にする」は、URL を登録した activity と手で入力した activity について、FR-033 と食い違う。削除は行を消す操作で、手で付ける値ではないので、ADR-0045 のほかの行とは食い違わない。

ADR-0045 のほかの決定は変わっていない。[docs/decisions/README.md](./README.md) は、承認した記録の決定内容を変えず、覆すときは新しい記録を書くと定める。1 行だけを覆すときも、元の記録をまるごと引き継ぐ新しい記録を書く（[#72 のコメント 6231369601](https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6231369601)）。この記録は ADR-0045 を引き継ぎ、隠し方の 1 行を置き換える。

ADR-0045 が挙げた外部の activity の取り方は、次のとおり変わっていない。取得元で消えたものの扱いの 5 つの型も、ADR-0045 の Context のとおり変わっていない。

- システムが一覧を取る: Zenn・Qiita・dev.to・Medium・GitHub・Speaker Deck・connpass。公開日を取れる
- オーナーが URL を登録し、題などをシステムが取る: Spotify・X・CodeSandbox。公開日を取れない
- オーナーがすべて手で書く: CodePen

## Decision Drivers

* 外部のデータの公開範囲は、外部のサービス側で決める
* どの取り方の activity にも、一覧から消える経路がある

## Considered Options

取得元で消えたものの扱い

* 取得元で消えたら一覧から消し、手で付ける値を持たない
* 残して、消えたと示す
* 残して、何も示さない（ADR-0009 の形）
* 写しを持つ
* 持ち主が手で隠す

URL を登録した activity と手で入力した activity を一覧から消す方法

* 外部のサービス側で非公開にする（ADR-0045 の形）
* synsk.me の側で削除できる

## Decision Outcome

Chosen option: "取得元で消えたら一覧から消し、手で付ける値を持たない", because 外部のデータの公開範囲を、外部のサービス側で決められるため。外部で非公開にした記事は、取得元で消えたことになり、一覧から消える。

Chosen option: "synsk.me の側で削除できる", because サーバーから取れない取得元では取得元で消えたことを確かめられず、ほかに一覧から消える経路が無いため。

- 外部の activity を取得して DB に持つ。取得に失敗したときは、DB に持つ前回の値で一覧を出す
- 取得元で消えたと確かめた activity は、何も示さずに、すぐ一覧から消す。確かめられないあいだは残す。消えていない記事を誤って消すより、消えた記事がしばらく残る方を許す
- 外部の activity に、オーナーが手で付ける値を持たない。コメント、表示の分類の上書き、非公開への切り替えを持たない。表示の分類は取得元ごとに決まる
- システムが一覧を取る activity を隠したいときは、オーナーが外部のサービス側で非公開にする
- URL を登録した activity と手で入力した activity は、オーナーが synsk.me の側で削除できる

### Consequences

* Good, because 開かないリンクが一覧に出ない
* Good, because 取得に失敗しても、前回の値で一覧を出せる
* Good, because 取った値と手で付けた値を分けて持つ必要がない
* Good, because サーバーから取れない取得元の activity も、一覧から消せる
* Bad, because 取得元で消えた記事は、synsk.me の一覧からも消える。記事の削除やサービス終了に耐えない
* Bad, because 取得元で消えたかの判定が要る
* Bad, because 同じ取得元の記事を 1 件だけ別の分類で見せることはできない
* Bad, because 一覧から消す方法が、取り方によって外部のサービス側と synsk.me の側に分かれる

### Confirmation

外部の activity に、コメント・表示の分類の上書き・公開範囲の列がないことは、`migrations/0004_create_activity.sql` の activity の CREATE TABLE で確かめられる。

取得元で消えた activity を一覧から消すこと、取得に失敗したときに前回の値で一覧を出すこと、URL を登録した activity と手で入力した activity を削除できることは、判定手段を定めていない。どれも取得と登録の処理が持つ振る舞いで、その処理はこの記録の時点でリポジトリにない。

## Pros and Cons of the Options

### 取得元で消えたものの扱い

**取得元で消えたら一覧から消し、手で付ける値を持たない — 採用** — 開かないリンクが一覧に出ない。ただし取得元で消えた記事は、synsk.me の一覧からも消える。

**残して、消えたと示す** — 取得元で消えた記事も、一覧に残る。ただし開かないリンクが一覧に残る。

**残して、何も示さない（ADR-0009 の形）** — 記事の削除やサービス終了に耐える。ただし開かないリンクが、開くリンクと見分けられずに一覧に残る。

**写しを持つ** — 取得元で消えた記事も読める。ただし記事の中身を synsk.me が保管する。

**持ち主が手で隠す** — オーナーが 1 件ずつ出すかを決められる。ただし外部のデータの公開範囲を、外部のサービスと synsk.me の 2 か所で決めることになる。

### URL を登録した activity と手で入力した activity を一覧から消す方法

**外部のサービス側で非公開にする（ADR-0045 の形）** — 公開範囲を外部のサービス側だけで決められる。ただしサーバーから取れない取得元では、取得元で消えたことを確かめられず、一覧から消えない。

**synsk.me の側で削除できる — 採用** — どの取り方の activity にも、一覧から消える経路がある。ただし外部のサービス側で消しても、synsk.me の側で削除するまで一覧に残る activity がある。

## More Information

この記録は [ADR-0045](./0045-external-activity-follows-source.md) を置き換える。ADR-0045 の「外部の activity を隠したいときは、オーナーが外部のサービス側で非公開にする」を、システムが一覧を取る activity に限り、URL を登録した activity と手で入力した activity の削除を足す。ほかはこの記録が引き継ぐ。

- [ADR-0009: 外部データを永続化し、手で付けた情報を再取得後も保持する](./0009-external-data-sync.md)
