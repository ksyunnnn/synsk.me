---
status: accepted
date: 2026-10-28
decision-makers: synsk
consulted: Claude Code
---

# 外部の activity は取得元の状態に従い、手で付ける値を持たない

## Context and Problem Statement

[ADR-0009](./0009-external-data-sync.md) は「外部 activity を自動で取得して永続化し、人が後から付けた情報は再取得後も保持する」と決めた。人が付ける情報を「コメント、表示分類の上書き、非公開への切り替え」とし、Consequences に「記事の削除やサービス終了に耐える」を挙げた。

外部の activity の取り方は 3 通りある。

- システムが一覧を取る: Zenn・Qiita・dev.to・Medium・GitHub・Speaker Deck・connpass。公開日を取れる
- オーナーが URL を登録し、題などをシステムが取る: Spotify・X・CodeSandbox。公開日を取れない
- オーナーがすべて手で書く: CodePen

取得元で消えたものの扱いには、5 つの型がある。

- 一覧から消す: [Mastodon](https://github.com/mastodon/mastodon/blob/9390d7d2f285926260c3c5c0b4fd06c726aebc70/app/lib/activitypub/activity/delete.rb#L19-L55)
- 残して、消えたと示す: [Wikipedia](https://en.wikipedia.org/w/index.php?title=Wikipedia:Link_rot&oldid=1375498571)・[Bluesky](https://github.com/bluesky-social/social-app/blob/ace74cf219d246eed23918399bbab98219f30eeb/src/components/Post/Embed/index.tsx#L255-L297)
- 残して、何も示さない: [Miniflux](https://github.com/miniflux/v2/blob/8de58f8b6fe11efb5b86024f64276e31b36f4572/internal/storage/entry.go#L319-L410)
- 写しを持つ: [Pinboard](https://pinboard.in/faq/)
- 持ち主が手で隠す: [catnose の timeline](https://github.com/catnose99/timeline/blob/2cce09796d5315be33a91d3b46ad74080bf95b8c/src/json-builder.ts#L101-L104)

## Decision Drivers

* 外部のデータの公開範囲は、外部のサービス側で決める

## Considered Options

* 取得元で消えたら一覧から消し、手で付ける値を持たない
* 残して、消えたと示す
* 残して、何も示さない（ADR-0009 の形）
* 写しを持つ
* 持ち主が手で隠す

## Decision Outcome

Chosen option: "取得元で消えたら一覧から消し、手で付ける値を持たない", because 外部のデータの公開範囲を、外部のサービス側で決められるため。外部で非公開にした記事は、取得元で消えたことになり、一覧から消える。

- 外部の activity を取得して DB に持つ。取得に失敗したときは、DB に持つ前回の値で一覧を出す
- 取得元で消えたと確かめた activity は、何も示さずに、すぐ一覧から消す。確かめられないあいだは残す。消えていない記事を誤って消すより、消えた記事がしばらく残る方を許す
- 外部の activity に、オーナーが手で付ける値を持たない。コメント、表示の分類の上書き、非公開への切り替えを持たない。表示の分類は取得元ごとに決まる
- 外部の activity を隠したいときは、オーナーが外部のサービス側で非公開にする

### Consequences

* Good, because 開かないリンクが一覧に出ない
* Good, because 取得に失敗しても、前回の値で一覧を出せる
* Good, because 取った値と手で付けた値を分けて持つ必要がない
* Bad, because 取得元で消えた記事は、synsk.me の一覧からも消える。記事の削除やサービス終了に耐えない
* Bad, because 取得元で消えたかの判定が要る
* Bad, because 同じ取得元の記事を 1 件だけ別の分類で見せることはできない

### Confirmation

外部の activity に、コメント・表示の分類の上書き・公開範囲の列がないことは、`migrations/0004_create_activity.sql` の activity の CREATE TABLE で確かめられる。

取得元で消えた activity を一覧から消すことと、取得に失敗したときに前回の値で一覧を出すことは、判定手段を定めていない。どちらも取得の処理が持つ振る舞いで、取得の処理はこの記録の時点でリポジトリにない。

## Pros and Cons of the Options

### 取得元で消えたら一覧から消し、手で付ける値を持たない

* Good, because 開かないリンクが一覧に出ない
* Bad, because 取得元で消えた記事は、synsk.me の一覧からも消える

### 残して、消えたと示す

* Good, because 取得元で消えた記事も、一覧に残る
* Bad, because 開かないリンクが一覧に残る

### 残して、何も示さない（ADR-0009 の形）

* Good, because 記事の削除やサービス終了に耐える
* Bad, because 開かないリンクが、開くリンクと見分けられずに一覧に残る

### 写しを持つ

* Good, because 取得元で消えた記事も読める
* Bad, because 記事の中身を synsk.me が保管する

### 持ち主が手で隠す

* Good, because オーナーが 1 件ずつ出すかを決められる
* Bad, because 外部のデータの公開範囲を、外部のサービスと synsk.me の 2 か所で決めることになる

## More Information

この記録は [ADR-0009](./0009-external-data-sync.md) を置き換える。ADR-0009 の「外部 activity を自動で取得して永続化し」は、この記録が引き継ぐ。
