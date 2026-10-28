---
status: accepted
date: 2026-10-28
decision-makers: synsk
consulted: Claude Code
---

# 外部の activity は取得元の状態に従い、手で付ける値を持たない

## Context and Problem Statement

[ADR-0009](./0009-external-data-sync.md) は「外部 activity を自動で取得して永続化し、人が後から付けた情報は再取得後も保持する」と決めた。人が付ける情報を「コメント、表示分類の上書き、非公開への切り替え」とし、Consequences に「記事の削除やサービス終了に耐える」を挙げた。

> ※根拠: ADR-0009 の Decision Outcome と Consequences の 1 行目を、原文のまま引いた（`docs/decisions/0009-external-data-sync.md`）。

外部の activity の取り方は 3 通りある。

- システムが一覧を取る: Zenn・Qiita・dev.to・Medium・GitHub・Speaker Deck・connpass。公開日を取れる
- オーナーが URL を登録し、題などをシステムが取る: Spotify・X・CodeSandbox。公開日を取れない
- オーナーがすべて手で書く: CodePen

> ※根拠: 72コメント「activity.sort_at_override と activity.comment を外す」の材料（PR #47 の検証による）: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6332241519

取得元で消えたものの扱いには、5 つの型がある。

- 一覧から消す: [Mastodon](https://github.com/mastodon/mastodon/blob/9390d7d2f285926260c3c5c0b4fd06c726aebc70/app/lib/activitypub/activity/delete.rb#L19-L55)
- 残して、消えたと示す: [Wikipedia](https://en.wikipedia.org/w/index.php?title=Wikipedia:Link_rot&oldid=1375498571)・[Bluesky](https://github.com/bluesky-social/social-app/blob/ace74cf219d246eed23918399bbab98219f30eeb/src/components/Post/Embed/index.tsx#L255-L297)
- 残して、何も示さない: [Miniflux](https://github.com/miniflux/v2/blob/8de58f8b6fe11efb5b86024f64276e31b36f4572/internal/storage/entry.go#L319-L410)
- 写しを持つ: [Pinboard](https://pinboard.in/faq/)
- 持ち主が手で隠す: [catnose の timeline](https://github.com/catnose99/timeline/blob/2cce09796d5315be33a91d3b46ad74080bf95b8c/src/json-builder.ts#L101-L104)

> ※根拠: 72コメント「取得元で消えたものの扱い（対象を広げた調査）」の型の表から、型ごとに例を 1〜2 つ選んだ: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6333150214

フィードの 1 回の応答は、全件とは限らない（[RFC 5005](https://www.rfc-editor.org/rfc/rfc5005.txt) の 1.2 節 "may or may not be a complete representation of the logical feed"）。Zenn の RSS は 20 件、Medium の RSS は 10 件を返す。

> ※根拠: RFC の引用は、72コメント「工程 5 の専門家レビューの結果」の 2-2 の根拠から: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6367923023 。件数は、72コメント「工程 4 の決定の補足（ADR の材料）」から: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6335216179

## Decision Drivers

* 外部のデータの公開範囲は、外部のサービス側で決める

> ※根拠: オーナーの発言「外部のデータは外部側で非公開にする」（72コメント「取得元で消えた activity は黙って一覧から消す」）: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334302040 。当てはまる原則は PRINCIPLES.md から見つけられなかったので、原則のリンクは置いていない。

## Considered Options

* 取得元で消えたら一覧から消し、手で付ける値を持たない
* 残して、消えたと示す
* 残して、何も示さない（ADR-0009 の形）
* 写しを持つ
* 持ち主が手で隠す

> ※根拠: 72コメント「工程 4 の決定の補足」の「比べた案」の 5 つ: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6335216179 。「残して、消えたと示す」は一度オーナーが選び、同じ日に覆した: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6333754937
> ※出典との違い: 出典は「残して何も示さない」を spec004 の FR-006 の形と呼ぶ。決定の記録から spec を指せない（参照の向き）ので、同じ形の ADR-0009（Option C「外部から消えても残る」）で呼んだ。また出典の 5 案は消えたときの扱いだけを比べ、手で付ける値（分類の上書き・visibility）は別に「残す／外す」で比べている。1 つの記録にまとめるため、採用案の名前に「手で付ける値を持たない」を足した。

## Decision Outcome

Chosen option: "取得元で消えたら一覧から消し、手で付ける値を持たない", because 外部のデータの公開範囲を、外部のサービス側で決められるため。外部で非公開にした記事は、取得元で消えたことになり、一覧から消える。

> ※根拠: because の後ろは、72コメント「工程 4 の決定の補足」の activity.visibility の「結果」の文から: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6335216179 。この文は Claude が書いた記録で、オーナーの言葉は Decision Drivers の 1 文だけ。

- 外部の activity を取得して DB に持つ。取得に失敗したときは、DB に持つ前回の値で一覧を出す

> ※根拠: 前半は ADR-0009 の Decision Outcome の前半を引き継いだ。後半はオーナーの決定（オーナーは「アプリケーションとして誠実なふるまい」とした）: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6332702104 。この決定のうち「一定の期間が過ぎたら一覧から消す」は取り消され、この行の部分は有効と確かめた: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6338154976

- 取得元で消えた activity は、何も示さずに、すぐ一覧から消す
- 消えていない記事を誤って消すより、消えた記事がしばらく残る方を許す

> ※根拠: 1 行目はオーナーの決定（「何も示さずに」は 6334302040、「すぐ」は 6338154976）: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334302040 。2 行目は 72コメント「専門家レビューの『前提そのものへの指摘』5 件の扱いを決めた」の 2-2 の「向き」: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6380570672 。同じ箇所の「全件を取れない取得元では、消えたと判定しない」「1 回で消す件数に上限を設ける」は、Claude が書いた制限なので書いていない（PR #194 のレビューでオーナーが決めた）。

- 外部の activity に、オーナーが手で付ける値を持たない。コメント、表示の分類の上書き、非公開への切り替えを持たない。表示の分類は取得元ごとに決まる
- 外部の activity を隠したいときは、オーナーが外部のサービス側で非公開にする

> ※根拠: コメントを外す: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6332241519 。表示の分類の上書きを外し、取得元ごとの activity_source.kind で決める: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334075336 。非公開への切り替え（activity.visibility）を外し、外部側で非公開にする: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334302040 。3 つは ADR-0009 が挙げた「人が付ける情報」の 3 つと同じ。

### Consequences

* Good, because 開かないリンクが一覧に出ない
* Good, because 取得に失敗しても、前回の値で一覧を出せる
* Good, because 取った値と手で付けた値を分けて持つ必要がない
* Bad, because 取得元で消えた記事は、synsk.me の一覧からも消える。記事の削除やサービス終了に耐えない
* Bad, because 取得元で消えたかの判定が要る
* Bad, because 同じ取得元の記事を 1 件だけ別の分類で見せることはできない

> ※根拠: 1・4・5 行目は、72コメント「工程 4 の決定の補足」の「結果」から: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6335216179 。6 行目も同じコメントの category_override の「結果」から。2 行目は ADR-0009 の Consequences の 2 行目を引き継いだ。3 行目は 72コメント 6334302040 の「工程 4 の候補の 3 つ目『取った値と手で付けた値を同じ行に持つか表を分けるか』は、問いとして無くなった」から。4 行目の後半は、ADR-0009 の Good の 1 行目が成り立たなくなったことを書いた。

### Confirmation

外部の activity に、コメント・表示の分類の上書き・公開範囲の列がないことは、`migrations/0004_create_activity.sql` の activity の CREATE TABLE で確かめられる。

取得元で消えた activity を一覧から消すことと、取得に失敗したときに前回の値で一覧を出すことは、判定手段を定めていない。どちらも取得の処理が持つ振る舞いで、取得の処理はこの記録の時点でリポジトリにない。

> ※根拠: migration 0004 の activity の列（source・external_id・url・title・description・image_url・published_at・happened_on・sort_at・card_media_id・created_at・updated_at）を読んで確かめた。取得の処理がないことは、`git grep` で migrations・docs・specs の外に fetch_result と activity_source を使うコードがないことで確かめた（2026-10-28、main の 1c38398）。

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

> ※根拠: 各案の Good と Bad は、Claude が型の定義（72コメント 6333150214 の表）と採用案の「結果」（6335216179）から書いた。オーナーが各案の利点と欠点を述べた記録はない。そのため、ここは特に確かめてほしい。

## More Information

この記録は [ADR-0009](./0009-external-data-sync.md) を置き換える。ADR-0009 の「外部 activity を自動で取得して永続化し」は、この記録が引き継ぐ。
