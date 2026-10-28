# Requirements

> この文書は満たすべきことだけを書く。進捗と実装方法は書かない。

---

## FR-01: activity を永続化する
根拠: [ADR-0045](./decisions/0045-external-activity-follows-source.md)

## FR-02: 外部 activity を自動で取得し、永続化する
根拠: [ADR-0045](./decisions/0045-external-activity-follows-source.md)

> ※根拠: 根拠を ADR-0009 から ADR-0045 に替えた。ADR-0045 が ADR-0009 を置き換え、「外部 activity を自動で取得して永続化し」を引き継いでいる。要件の文は変えていない。

## FR-03: career と project を永続化する
根拠: [ADR-0044](./decisions/0044-content-data-model-by-organization.md)

## FR-05: note に、公開前の下書き状態を持てる
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

> ※削除: FR-06「公開済みの activity を、データを保持したまま非公開にできる」を消した。
> ※根拠: 72コメント「取得元で消えた activity は黙って一覧から消す」で、オーナーが決めた。外部の activity は外部のサービス側で非公開にし、synsk.me に隠す列を持たない。life event の行も隠さない（出したくないときは行を消す）: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334302040 。ADR-0045 の Decision Outcome に書いた。非公開にできる activity が残らないので、spec へ移さずに消した。ID は使い回さない。FR-04 と FR-12 も、spec へ移したあと（コミット c94aab8）番号を使い回していない。
> ※確かめてほしいこと: 根拠の ADR-0008 の「公開済みのものは、削除せずに非公開へ戻せる」は、activity に限らない文なので直していない。note は FR-05 と spec が非公開に戻すことを扱う。

## FR-07: career と project は、公開・限定公開・非公開の3段階を区別して保持できる
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

## FR-08: career と project は、公開できる値と公開できない値の両方を保持できる
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

> ※削除: FR-09「外部 activity を再取得しても、手で付けた情報が保持される」を消した。
> ※根拠: 外部の activity にオーナーが手で付ける値（コメント・表示の分類の上書き・非公開への切り替え）を、オーナーがすべて外した。72コメント 6334302040 に「これで、外部の activity にオーナーが手で付ける値は無くなった」とある: https://github.com/ksyunnnn/synsk.me/issues/72#issuecomment-6334302040 。ADR-0045 の Decision Outcome に書いた。保つ値がないので、spec へ移さずに消した。

## FR-10: note の過去の版を保持し、任意の版に戻せる
根拠: [ADR-0010](./decisions/0010-content-storage-scope.md)

## FR-11: 永続化したデータを完全に削除できる
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

## FR-13: 公開されたときの見た目を、公開前に確認できる
根拠: [ADR-0014](./decisions/0014-authoring-and-datastore.md)

## FR-14: 保存操作をせずに編集内容が保持される
根拠: [ADR-0014](./decisions/0014-authoring-and-datastore.md)

## FR-15: note に URL を入力すると、参照先の情報を伴う表示になる
根拠: [ADR-0014](./decisions/0014-authoring-and-datastore.md)

## FR-16: スマートフォンから note を作成・編集・公開できる
根拠: [ADR-0014](./decisions/0014-authoring-and-datastore.md)

## FR-17: note の公開と修正が、公開操作の後に別の工程を挟まずに反映される
根拠: [ADR-0014](./decisions/0014-authoring-and-datastore.md)

## FR-18: 職務経歴書を複数保持し、それぞれに公開範囲を設定できる
根拠: [ADR-0015](./decisions/0015-multiple-resumes.md)

## NFR-01: 永続化したデータ全体を復元できる
根拠: なし

## NFR-02: データがない・読み込み中・一部欠損・エラーの各状態で画面が成立する
根拠: なし

## NFR-03: 訪問者が到達する経路の LCP が、モバイルとデスクトップそれぞれの75パーセンタイルで 2,500 ミリ秒以内である。1,100 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-04: 訪問者が到達する経路の INP が、モバイルとデスクトップそれぞれの75パーセンタイルで 200 ミリ秒以内である。75 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-05: 訪問者が到達する経路の CLS が、モバイルとデスクトップそれぞれの75パーセンタイルで 0.1 以下である。0 を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-06: 訪問者が到達する経路の TTFB が、モバイルとデスクトップそれぞれの75パーセンタイルで 800 ミリ秒以内である。450 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-07: 訪問者が到達する経路の FCP が、モバイルとデスクトップそれぞれの75パーセンタイルで 1,800 ミリ秒以内である。900 ミリ秒を目標とする
根拠: [ADR-0017](./decisions/0017-display-speed-thresholds.md)

## NFR-08: 公開していない内容は、その公開範囲の外の人への応答に含まれない
根拠: [ADR-0008](./decisions/0008-content-visibility.md)

## NFR-09: 認証を要する応答と、公開していない内容を含む応答は、どのキャッシュにも残らない。認証には、配信の環境全体にかける認証を含む。ただし、静的ファイルを、Cloudflare の静的ファイルの配信がエッジに持つことは除く
根拠: [ADR-0040](./decisions/0040-cache-components.md)、[ADR-0041](./decisions/0041-preview-no-store.md)
