---
status: proposed
date: 2026-11-09
decision-makers: synsk
consulted: Claude Code
---

# 管理画面の URL は、slug とは別の書き換えない uid で行を指す

## Context and Problem Statement

[ADR-0048](./0048-url-conventions-with-project-uid.md) は「主キーは URL に出さない」とし、管理画面を `/dash/` 配下に置くと決めた。管理画面で 1 行ずつ開く画面の URL に、何で行を指すかは決めていない。

訪問者向けの URL の識別子（slug）は、書き換わる。

- 実績の slug は、オーナーが書き換えられ、秘匿化に切り替えると新しい uid に戻る（ADR-0048）
- 限定公開用の職務経歴書の slug は、URL を出し直すと新しい uid に変わる。公開用の職務経歴書の slug は、オーナーが書き換えられる（[ADR-0050](./0050-url-conventions-with-resume-uid.md)）
- 限定公開用の職務経歴書の slug は、URL を開く鍵を兼ねる（ADR-0050）

組織・職歴・スキル・学歴と、職務経歴書に写した行は、slug を持たない。

`docs/SOFTWARE_DESIGN.md` は、列の名前を意味ごとに 1 つにすると定める（「列の名前を意味ごとに1つにする」）。

SQLite の `randomblob(N)` は N バイトの擬似乱数を返す（[Built-In Scalar SQL Functions](https://sqlite.org/lang_corefunc.html#randomblob)、2026-11-08 に確認）。CREATE TABLE の DEFAULT は括弧で囲んだ式を取れる。

## Decision Drivers

* [守る over 手軽さ](../SOFTWARE_DESIGN.md#1-守る-over-手軽さ)。URL を開く鍵を、管理画面の外に残さない
* 開いている管理画面の URL が、識別子の書き換えで別の行を指したり、どの行も指さなくなったりしない

## Considered Options

管理画面で行を指す識別子

* slug を持つ表は slug を使い、持たない表にだけ uid を足す
* URL だけを uid にし、フォームは主キーを送る
* slug とは別の uid を、管理画面で 1 行ずつ開くすべての表に持たせ、URL とフォームで使う

uid を作る場所

* アプリケーションが作る
* DB の DEFAULT が入れる

## Decision Outcome

Chosen option: "slug とは別の uid を、管理画面で 1 行ずつ開くすべての表に持たせ、URL とフォームで使う", because slug は書き換わり、限定公開用の職務経歴書では URL を開く鍵を兼ねるため。

Chosen option: "DB の DEFAULT が入れる", because 職務経歴書に行を写す文を含む、どの INSERT でも入れ忘れないため。

- 管理画面で 1 行ずつ開く画面の URL は、その行の uid で表す。訪問者向けの URL の識別子を slug、管理画面の URL の識別子を uid と呼び分け、どの表でも同じ名前にする
- 編集と削除のフォームも uid を送る。主キーは、管理画面の URL にもフォームにも出さない
- uid は題や作った順から推測できない乱数とし、作った後に変えない
- uid は DB が入れ、アプリケーションは作らない

### Consequences

* Good, because slug を書き換えても、開いている管理画面の URL が同じ行を指し続ける
* Good, because 限定公開用の職務経歴書の鍵が、管理画面の URL としてブラウザの履歴などに残らない
* Good, because 写した行を入れる文が uid を渡し忘れても、DB が値を入れる
* Bad, because slug を持つ表は、URL に出す識別子を 2 つ持つ
* Bad, because 既にある表に、式の DEFAULT を持つ NOT NULL・UNIQUE の列を足すには、表を作り直す。ALTER TABLE ADD COLUMN の DEFAULT は式を取れない（[ALTER TABLE](https://sqlite.org/lang_altertable.html#altertabaddcol)、2026-11-08 に確認）

### Confirmation

uid の列と DEFAULT、書き換えの拒否は、`tests/workers/migrations.test.ts` が workerd で確かめる。管理画面のリンク・保存の後の redirect 先・隠しフィールドに数字だけの識別子が出ないことは、`tests/integration/dash-url-without-id.test.ts` が確かめる。

## Pros and Cons of the Options

### 管理画面で行を指す識別子

**slug を持つ表は slug を使い、持たない表にだけ uid を足す** — 足す列が少ない。ただし slug の書き換えのたびに管理画面の URL が変わる。表ごとに識別子の名前が分かれる。

**URL だけを uid にし、フォームは主キーを送る** — フォームを変えずに済む。ただし保存の後の redirect 先を作るのに uid を別に引くことになり、主キーを画面に出し続ける。

**slug とは別の uid を、管理画面で 1 行ずつ開くすべての表に持たせ、URL とフォームで使う — 採用** — 書き換わらない識別子で行を指せる。どの表でも同じ名前で引ける。

### uid を作る場所

**アプリケーションが作る** — 表を作り直さずに列を足せる。ただし写した行を入れる文のすべてに値を渡すことになり、渡し忘れを DB が拒めない。

**DB の DEFAULT が入れる — 採用** — どの INSERT でも入れ忘れない。

## More Information

この記録は ADR-0048 と ADR-0050 を置き換えない。ADR-0048 の「主キーは URL に出さない」と「管理画面は `/dash/` 配下に置く」を、管理画面で行を指す識別子に当てはめる。

- 列の形と入れ方: `migrations/0011_add_uid_for_dash_url.sql`
