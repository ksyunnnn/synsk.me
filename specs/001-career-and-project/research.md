# Research: 職歴と実績

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。決められないものは「未決」として理由と止める範囲を書く。未決の一覧は plan.md の「未決」が持つ。

## Contents

- R1 スキーマの前提
- R2 D1 への読み書き
- R3 行の型（#188 が未決）
- R4 作り手の判定
- R5 秘匿化の選別をどこで行うか
- R6 識別子（slug）の uid
- R7 同時編集の楽観ロック
- R8 削除の順序
- R9 個人の組織
- R10 機能の切り方
- R11 管理画面の部品（headless のライブラリが未決）
- R12 キャッシュと 404・403
- R13 経験年数と期間の重なり（数え方が未決）
- R14 本文と画像（書式・上限・配る経路が未決）
- R15 職歴を訪問者に出す場所
- R16 編集中の内容の保持（REQUIREMENTS.md の FR-14）

---

## R1 スキーマの前提

- 決めたこと: `migrations/0001`〜`0007` に、ブランチ `feature/72-schema-adjustments` のコミット `4704df4` の `migrations/0008_rebuild_career_and_project.sql` を当てたスキーマを前提にする。0008 は feature/72-rebuild に入っていない。D1 を使う検査（workerd・結合・E2E）は、0008 が feature/72-rebuild に入ってから回す
- 理由: 0008 が、spec の FR-001（秘匿化した組織名は空にできる）・FR-010・FR-015（既定で秘匿化）・FR-033・FR-034（月まで）を列に反映する
- 退けた案: 0007 までのスキーマで作る。`organization.name_masked` が NOT NULL、`skill.years_override` が年の整数で、FR-001・FR-034 を満たせない

## R2 D1 への読み書き

- 決めたこと: ORM とクエリビルダを使わず、`env.DB.prepare()`・`bind()`・`batch()` を Repository の実装（機能の `server/`）の中だけで使う。複数の文をまとめて書くときは `batch()` を使う
- 理由: ADR-0035（#78 の結論）。`batch()` は「Batched statements are SQL transactions」で、1 文が失敗すると「it aborts or rolls back the entire sequence」（[D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)、2026-11-04 に確認）
- 退けた案: ORM（ADR-0035 が退けた）

## R3 行の型（#188 が未決）

- 決めたこと: 表の行の型は、表ごとに 1 つの Repository の実装のファイルの中だけで書き、そこで domain の型に詰め替える。CHECK で守る値の一覧（`project.kind` の `application`・`talk`・`event`・`other`）は、domain に `as const` の配列で 1 か所に置く
- 理由: #188 がどちらに決まっても、差し替える場所が Repository の実装の行の型と、CHECK の値の配列の 2 か所に限られる。手で書いた行の型が実物と食い違うことは、本物の migration を当てた workerd の検査で補う（ADR-0035 の Consequences）
- 未決: 型を生成するか、生成するなら何で作るか（#188）。止めるタスクは無い

## R4 作り手の判定

- 決めたこと: ログインは Cloudflare Access が行う（ADR-0013、`design/guidelines.md` の Managing accounts）。アプリケーションは、`/dash` 配下の画面を返す前と、書き込みの Server Action の先頭で、`Cf-Access-Jwt-Assertion` の JWT を `jose` で検証する。確かめるのは署名・発行元・aud・期限・メールアドレスがオーナーのものであること。設定値は Worker の secret（`ACCESS_ISSUER`・`ACCESS_AUD`・`ACCESS_OWNER_EMAIL`）に置き、どれかが欠ければ作り手とみなさない
- 理由: ADR-0036。Server Action は経路に縛られないため、Access だけでは書き込みを守れない
- 置き場: `src/shared/server/author.ts`。使い手は `career`・`project`・`education`・`skill`・`organization` の管理画面と、002・003 の管理画面（constitution IX の 2 つ目の使い道）
- 検査: 単体で検証の分岐（JWT なし・署名違い・aud 違い・期限切れ・別のメールアドレス・設定値の欠け）を確かめる。結合で JWT のない `/dash` が 403、JWT のない書き込みが何も書かないことを確かめる。テスト用の鍵と公開鍵のサーバは `tests/support/access.ts` を使う
- 退けた案: Access だけに任せる（ADR-0036 が退けた）

## R5 秘匿化の選別をどこで行うか

- 決めたこと: 訪問者向けの実績の取り出しは、Repository の実装の中で `is_masked` を見て、出してよい列だけを SELECT し、訪問者向けの DTO に詰める。秘匿化した実績では、`title`・`organization.name`・`description`・`url`・`card_media_id` と画像を SELECT しない
- 理由: ADR-0029（取り出すときに確かめる）、ADR-0028（DTO）、constitution の Allowlist Visibility。読まない値は応答に混ざらない
- 出してよい値は spec の FR-026: 秘匿化した題・秘匿化した組織名・期間・種類・使ったスキル（実績）。ページの `<title>` と OGP にも同じ DTO の値だけを使う
- 退けた案: 全列を読んで画面で外す（ADR-0029 が退けた）

## R6 識別子（slug）の uid

- 決めたこと: 新しい実績と、秘匿化に切り替えた実績の識別子は `crypto.randomUUID()` の値にする。36 文字の英小文字（16 進）・数字・ハイフンで、FR-013 の形（1〜100 文字、`[a-z0-9-]`）と `project.slug` の CHECK に収まる
- 理由: FR-013 は題や組織名から推測できない uid を求める。Workers の Web Crypto が持つ（[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)）
- 秘匿化した実績の識別子を書き換える要求は、アプリケーションで拒む（FR-013）
- 退けた案: id を使う（ADR-0016 と migration 0003 の注釈が、URL に id を出さないとする）

## R7 同時編集の楽観ロック

- 決めたこと: 編集の画面を開いたときの `updated_at` を隠しフィールドで持ち、保存は `UPDATE … SET …, updated_at = ?新しい値 WHERE id = ? AND updated_at = ?開いたときの値` で行う。新しい値はアプリケーションが `new Date().toISOString()` で作る。同じ `batch()` の後続の文（`project_skill` の入れ直しなど）は `WHERE EXISTS (SELECT 1 FROM project WHERE id = ? AND updated_at = ?新しい値)` を付け、UPDATE が当たらなければ何も書かない。UPDATE の `meta.changes` が 0 なら、保存を止め、送られた内容をフォームに戻して知らせる
- 理由: spec の FR-042 と台帳 12 節（note と同じ楽観ロック）。台帳 11 節の根拠（Fowler の Optimistic Offline Lock、RFC 9110 §13.1.1）。`updated_at` の形は `toISOString()` と migration の CHECK（`%Y-%m-%dT%H:%M:%fZ`）で同じ。updated_at のトリガは `NEW.updated_at IS OLD.updated_at` のときだけ働くため、アプリケーションが入れた値を上書きしない
- 対象: 職歴・実績（FR-042）。学歴・組織・スキルは FR-042 の対象に無いため付けない
- 限界: 2 つの保存が同じミリ秒に当たると見分けられない。オーナー 1 人の操作では起きにくいとみなす
- 退けた案: 版の列を足す（台帳 11 節は列を足さない）

## R8 削除の順序

- 決めたこと: 物理削除は 1 つの `batch()` で、子の行を先に消すか空にしてから親を消す
  - 実績: `resume_project.project_id` を NULL にする → `project.card_media_id` を NULL にする → `project_skill` を消す → `media`（持ち主が実績）を消す → `project` を消す。R2 の画像は D1 の削除が成功した後に消す
  - 職歴: `resume_career.career_id` を NULL にする → `media`（持ち主が職歴）を消す → `career` を消す
  - 学歴: `resume_education.education_id` を NULL にする → `education` を消す
  - スキル: `project_skill` を消す → `skill` を消す。`resume_project_skill` と `resume_skill_override` は名前を写して持つため触らない
  - 組織: 職歴・実績が指していれば消さずに知らせる（FR-006）
- 理由: 外部キーはすべて NO ACTION で、子の行が残ると削除がエラーで止まる（migration 0003 の冒頭、台帳 6 節）。職務経歴書の行は残す（spec の Edge Cases、台帳 7 節の「写した行の *_id を先に空にする」）
- R2 と D1 のずれ: D1 を先に消し、R2 の削除に失敗しても画像は訪問者に出ない（持ち主の行が無いため配らない）。ずれの扱いは台帳 6 節の未決のまま
- 退けた案: CASCADE（台帳 7 節が退けた）

## R9 個人の組織

- 決めたこと: 個人の組織の `organization.id` を、`src/shared/domain/organization.ts` の定数に置く。値は、本番の D1 にオーナーが個人の組織を登録した後、その行の id を書く。プレビューと検査の D1 は、同じ id で個人の組織を入れる
- 理由: spec の FR-041 と台帳 12 節（コードの定数で見分け、スキーマに印を足さない）。名前は変わりうるため、名前でなく id で見分ける
- 使い手: 002 の職務経歴書（台帳 1 節の「個人スキル」）。001 の中では、組織の削除の画面で個人の組織を消せないようにする
- 退けた案: 組織名で見分ける（名前を変えると見分けられない）

## R10 機能の切り方

- 決めたこと: ADR-0027 の決まり（もの（データ）の名前で切る）に従い、`src/features/` に `project`・`career`・`education`・`skill`・`organization` を置く。組織の選択肢と「選ぶか作る」の処理は `career` と `project` の両方が使うため、`src/shared/domain/organization.ts` と `src/shared/server/organization-repository.ts` に置く。期間の計算は `skill`・`career`・002 の職務経歴書が使うため `src/shared/domain/period.ts` に置く
- 理由: ADR-0026 の依存の向き（機能どうしは import しない、複数の機能で使うものは `shared/`）。機能をまたいで要る値は、各機能の Repository の実装が SQL で読む
- 確認を求めること: ADR-0027 が挙げる名前は `activity`・`note`・`project`・`career`・`resume` の 5 つで、`education`・`skill`・`organization` は挙げていない。この plan は決まりを当てはめて足す
- 退けた案: すべてを `career` に入れる（ADR-0027 が `project` と `career` を分ける）

## R11 管理画面の部品（headless のライブラリが未決）

- 決めたこと: 入力は、ネイティブの要素（`input`・`select`・`textarea`・`input type="date"`・`input type="checkbox"`）と `<form action={Server Action}>` で作る。JavaScript なしでも保存できる
- 未決: headless のライブラリをどれにするか。`design/guidelines.md` の Components と ADR-0026 は headless のライブラリに任せるとするが、ライブラリを決めた記録は無い。ADR-0032 は例に Base UI と shadcn/ui を挙げる。`components.json`（shadcn/ui の設定）はあるが、headless のライブラリは `package.json` に無い
- 止める範囲: 組織名の入力（FR-002 の、自由に入力でき選択肢を出す部品）。ネイティブの `<input list>` と `<datalist>` で満たすかも、この未決に含める
- 置き場: ライブラリに見た目をかぶせた部品は `src/shared/components/` に置く（ADR-0026）

## R12 キャッシュと 404・403

- 決めたこと: 実績のページ（`/projects/[slug]`）と管理画面は `'use cache'` を使わない。データを読んでから決まる 404（識別子の実績が無い）と 403（作り手でない `/dash`）は `src/proxy.ts` が描画の前に決め、`notFound()` か `forbidden()` を呼ぶだけのページへ rewrite する。`export const revalidate` と `export const dynamic` は書かない
- 理由: constitution の Cacheability（ADR-0040）。キャッシュを使わないため、秘匿化を切り替えた時点から新しい状態で出る（FR-043）。キャッシュは計測値が閾値を割るまで足さない（constitution VI、台帳 6 節の「公開の即時反映とキャッシュは後に回す」）
- proxy の作り直し: note に固有の部分（`/notes/:slug`、`/dash/notes/*`）は 003 が持つため入れない。matcher は `/projects/:slug`・`/dash`・`/dash/:path*`
- 退けた案: 実績のページを `'use cache'` にし、保存のたびに無効化する（計測値が無い）

## R13 経験年数と期間の重なり（数え方が未決）

- 決めたこと: 計算は副作用の無い関数にし、`src/shared/domain/period.ts` に置く。入力は期間（始まりの日・終わりの日または空）の並びと、求める日。期間を始まりの日で並べ、重なるものをつないでから長さを足す。求めた値は保存しない（FR-033）。上書きの月数があればそれを使う（FR-034）。表示は年と月（例: 5 年 11 か月）
- 未決（オーナーに確かめる）: 次の 4 つが spec と台帳に無い。SC-004 の「手で計算した値」が決まらない
  1. つないだ日の範囲を、年と月に直す規則（暦の月の差を取り端数の日を切り捨てるか、日数を平均の月の長さで割るか、など）
  2. 終わりの日をその期間に含めるか
  3. 終わりの日が空の期間の「求める日」の日付を、どの時刻帯の今日にするか
  4. 職歴と実績の期間が端の日だけ接するとき、重なるとみなすか（FR-017・FR-035）
- 止める範囲: 経験年数の計算と表示、職歴の実績と職歴のスキルの求め方

## R14 本文と画像（書式・上限・配る経路が未決）

- 決めたこと: 本文は `career.description`・`project.description` に文字列で持つ。画像の記録は `media` に持ち、持ち主の列は職歴か実績のどちらか 1 つ（migration 0005）。代表画像は `project.card_media_id` で、その実績の画像だけを指す（複合の外部キー）。秘匿化した職歴・実績の画像は配らない（FR-030）
- 未決（オーナーに確かめる）:
  1. 本文の書式（spec の「決定が無く、この spec では決めない」）。止める範囲は、本文の表示と、本文の中に画像とキャプションを置く入力（FR-027）
  2. 画像の形式と大きさの上限。constitution II は費用のかかる処理に量と回数の上限の値を求める。003 の spec も未決とする。止める範囲は画像の追加（FR-027・FR-028）
  3. 画像を配る経路（URL と、持ち主ごとの確かめを置く場所）。spec は「画像を収める場所と、画像を配る仕組みは note の spec と共有する」とする。この plan の案は、実績の画像を `/projects/[slug]/media/[id]` で `project` の Repository が確かめて配ること。職歴の画像は、職歴を訪問者に出す 005・002 が配る。止める範囲は画像の配信
  4. 伏せた見た目の本文の形（spec の「決定が無く」）。止める範囲は見た目だけで、本文の中身を応答に含めない決まり（FR-021）は止めない
- 置き場: R2 は `wrangler.jsonc` の binding `NOTE_IMAGES`（バケット `synsk-me-images`）。読み書きは `src/shared/server/media-storage.ts` に閉じ込める（constitution VIII）。使い手は `project`・`career`・003 の note

## R15 職歴を訪問者に出す場所

- 決めたこと: 001 は、職歴を訪問者に出すページを持たない。訪問者に職歴を出す場所は一覧（005）と職務経歴書（002）で、005 の spec の User Story 2 と FR-012〜FR-014 が、一覧の応答での職歴の秘匿化を確かめる。001 の検査は、職歴の保存の決まり（既定で秘匿化・秘匿化した組織名の必須・期間）までとする
- 理由: spec の Assumptions（一覧の spec が職歴と実績を一覧に並べる）、台帳 5 節（一覧はビューで読み、秘匿化の決まりはビューの中に書く）。constitution III により、001 の中で検査を対応させられない訪問者側の職歴の要件（FR-009・FR-020、FR-021・FR-022・FR-030 の職歴の部分、User Story 2 の 3）は 001 の範囲から外し、005 で確かめる
- 確認を求めること: この割り当て

## R16 編集中の内容の保持（REQUIREMENTS.md の FR-14）

- 決めたこと: 001 の入力の画面（職歴・実績・学歴・組織・スキル）は、入力中の内容をブラウザの `localStorage` に持ち、保存に成功したら消す。D1 には書かない。持つ処理は `src/shared/components/` の 1 つの部品にまとめ、5 つの画面と 003 の note の画面が使う
- 理由: spec の Assumptions が FR-14 を REQUIREMENTS.md の持ち物として挙げる。台帳 6 節の決定（自動保存は DB に書かない）
