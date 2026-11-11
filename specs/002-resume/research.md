# Research: 職務経歴書

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。決められないものは「未決」として理由と止める範囲を書く。未決の一覧は plan.md の「未決」が持つ。001 の research.md と同じ決め方をする項目は、001 の項目を指して違いだけを書く。

## Contents

- R1 スキーマの前提
- R2 001 から使うもの
- R3 機能の切り方と URL
- R4 写し方
- R5 限定公開用の URL
- R6 中身を返す条件
- R7 キャッシュ・検索・404
- R8 同時編集の楽観ロック
- R9 削除の順序
- R10 プロフィールとメールアドレス
- R11 PDF を作る仕組み
- R12 経験年数とスキルの一覧
- R13 本文と画像
- R14 作ったあとに足す
- R15 一度に写す行の上限

---

## R1 スキーマの前提

- 決めたこと: `migrations/0001`〜`0008` を当てたスキーマを前提にする。写し方は 0008 の `resume.audience` の注釈を正とし、0006 の `resume_career.organization_name`・`resume_project.title` の注釈は使わない（0008 の冒頭）
- 理由: 0008 が `resume.audience` の既定値 `limited`（FR-003）と `resume_skill_override.months_override`（月数、FR-028）を列に反映する
- 写した職歴・実績が作ったときに秘匿化していたかは、0008 の `resume_career.is_masked`・`resume_project.is_masked` が持つ（data-model.md の「秘匿化していたかの列」、plan.md の U2）

## R2 001 から使うもの

- 決めたこと: 002 は次の 001 の部品を、変えずに使う

| 部品 | 置き場 | 002 での使い道 | 001 の状態 |
|---|---|---|---|
| オーナーの判定 | `src/shared/server/author.ts` | 管理画面のページと Server Action の先頭 | 済み（001 の T003） |
| env の読み出し | `src/shared/server/env.ts` | D1 の binding・メールアドレス | 済み（001 の T002）。002 で型を足す |
| 期間 | `src/shared/domain/period.ts` | 写した期間の検証と、経験年数の計算 | 期間の検証は済み（001 の T015）。経験年数は 001 の T061（U6 が解けてから） |
| 入力の部品 | `src/shared/components/field.tsx` | 管理画面の入力 | 済み（001 の T022） |
| Server Action の結果の型 | `src/shared/domain/action-result.ts` | 管理画面の Server Action | 済み（001 の T023） |
| 404 と 403 の判定 | `src/proxy.ts` | `/resume/*` と `/dash/resumes/*` を足す | 済み（001 の T005）。`/projects/:slug` は 001 の T034 が足す |
| 管理画面の入口 | `src/app/dash/page.tsx` | 職務経歴書の一覧へのリンクを足す | 済み（001 の T014） |
| 作り物の行を入れる道具 | `tests/support/career-and-project-rows.ts` | 写し元の行 | 済み（001 の T021） |

- 002 が使わないもの: 個人の組織の定数（`src/shared/domain/organization.ts` の `PERSONAL_ORGANIZATION_ID`）。001 の research.md の R9 は 002 を使い手に挙げるが、002 の spec に個人の組織を見分ける要件は無い
- 002 は 001 の機能（`src/features/project/` など）を import しない（ADR-0026）。写し元の値は、002 の Repository の実装が SQL で読む（001 の research.md の R10）

## R3 機能の切り方と URL

- 決めたこと: `src/features/resume/` に domain・application・components・server を置く。名前は ADR-0027 が挙げる `resume`
- 訪問者の URL: 公開用と限定公開用は `/resume/{slug}`（R5）。`resume.slug` は限定公開用と公開用をまたいで UNIQUE のため、1 つの経路で識別子から行を引ける。PDF は同じページを印刷して作り、経路を持たない（R11）
- 理由: ADR-0048 は URL をコレクション名と識別子で表し、職務経歴書に permalink を持たせる。ADR-0048 の Consequences は職務経歴書のコレクション名を `/resume` とする
- `/resume/{slug}/missing` は `/resume/{slug}` の下にあり、訪問者の経路と重ならない
- 管理画面は `/dash/resumes/*`（contracts/dash.md）。001 の `/dash/projects` と同じく複数形にする。職務経歴書と写した行は `uid` で開き、`resume.slug` を管理画面の URL に使わない（001 の research.md の R17）
- `src/app/resume/page.tsx`（`/resume`）は 002 の spec に要件が無く、002 は触れない。002 は `src/app/resume/[slug]/` の下だけを足す
- 食い違い: ADR-0048 の Decision Outcome は「note と職務経歴書の slug は、題から候補を提示し、オーナーが確定させる」とする。spec の FR-037・FR-039 は、識別子を既定で uid とし、限定公開用は書き換えられないとする。plan は spec に従う。ADR を直すかはオーナーが決める（plan.md の U14）

## R4 写し方

- 決めたこと: 作成のユースケースは、読む → 計算 → 書くの順にする（docs/SOFTWARE_DESIGN.md）
  1. 読む: 選んだ id の職歴・実績・学歴を、組織・スキル・上書きとともに 1 回の `batch()` で読む
  2. 計算: `src/features/resume/domain/build-resume.ts` が、限定公開用か公開用かで写す値を選ぶ（data-model.md の「写し方」）
  3. 書く: `resume` と写した行を 1 回の `batch()` で入れる。子の行の `resume_id` は `(SELECT id FROM resume WHERE slug = ?)`、`resume_project_skill.resume_project_id` は `(SELECT id FROM resume_project WHERE resume_id = … AND project_id = ?)` で引く。識別子はアプリケーションが作るため、入れる前に決まっている
- 理由: `batch()` は 1 つのトランザクションで、1 文が失敗すると全体を戻す（001 の research.md の R2）。作りかけの職務経歴書が残らない
- 公開用で秘匿化した職歴・実績の `description`・`url` は写さない（NULL）。spec はどちらでも FR-017 を満たすとし、実装のときに決めるとする。読まない値は応答に混ざらない（ADR-0029、001 の research.md の R5 と同じ考え）。オーナーが職務経歴書の中で書き足した本文は、写した行の `is_masked` で伏せる（U2）
- 公開用で、秘匿化した職歴・実績が秘匿化した組織名の無い組織を指していたら、作らずに知らせる（constitution II）。001 の FR-001 がこの状態を保存の前に拒むため、起きるのは 001 の決まりの外で D1 を書き換えたときだけ
- 退けた案: `INSERT … SELECT` で写し元から直接写す。写し方の分岐が SQL の CASE に入り、単体で確かめられない

## R5 限定公開用の URL

- 決めたこと: 限定公開用の URL は `/resume/{slug}` だけにする。識別子は `crypto.randomUUID()` の uid（FR-012・FR-037）で、識別子を知っている人が読める。URL に識別子のほかの値を持たず、ハッシュも照合も持たない
- 出し直し: 設定の画面の「URL を出し直す」で、識別子を新しい uid に書き換える。古い識別子の URL は R6 の取り出しで行が見つからず 404 になる（FR-040）。書き換えは R8 の楽観ロックと同じ 1 つの UPDATE で行い、`audience = 'limited'` の行だけを書く
- 示し方: 識別子は D1 にあるため、作成の画面と設定の画面のどちらでも URL を示す（FR-040）
- 理由:
  - 2026-11-08 のオーナーの決定（spec の Clarifications）
  - Workers の `crypto.randomUUID()` は「Generates a new random (version 4) UUID」（[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、2026-11-08 に確認）。UUID v4 は 128 ビットのうち version の 4 ビットと variant の 2 ビットを除く 122 ビットが乱数である（[RFC 9562 の 5.4](https://www.rfc-editor.org/rfc/rfc9562#section-5.4)、2026-11-08 に確認）
  - W3C TAG の Capability URLs は、推測できない値にすること・期限を持たせること・https にすることを勧め、値をパスに置く例を示す。文書は 2014-02-18 の First Public Working Draft で、勧告にならない（[Good Practices for Capability URLs](https://www.w3.org/TR/capability-urls/)、2026-11-04 に確認）
- Referer: 限定公開用のページから外へのリンクで URL が漏れないよう、応答に `Referrer-Policy: no-referrer` を付ける（R7）。OWASP は、秘密の値を含む再設定のページに `no-referrer` を勧める（[Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)、2026-11-04 に確認）

## R6 中身を返す条件

- 決めたこと: 訪問者向けの取り出しは、条件をすべて SQL の WHERE に入れ、条件に合わなければ行を返さない
  - 公開用: `slug = ? AND audience = 'public' AND status = 'published'`
  - 限定公開用: `slug = ? AND audience = 'limited' AND status = 'published' AND (limited_expires_at IS NULL OR limited_expires_at > ?今の日時)`。行が返ったときだけ写した行を読む
- 今の日時はアプリケーションが `new Date().toISOString()` で作る。`limited_expires_at` の CHECK の形（`%Y-%m-%dT%H:%M:%fZ`）と同じため、文字列の比較が日時の比較になる
- 理由: ADR-0029（取り出すときに確かめる）。中身を返さない 4 つの状態（非公開・期限切れ・識別子が合わない・出し直す前の識別子、SC-003）を同じ取り出しで区別なく弾く
- 返さないときの応答は 404 にそろえる。状態を区別して返すと、識別子の有無や期限切れが URL を知らない人に分かる。W3C の Capability URLs も、期限が切れたら 410 か 404 を返すとする（R5）。画面に何を示すかは spec が決めない（plan.md の U10）

## R7 キャッシュ・検索・404

- 決めたこと: 職務経歴書のページは `'use cache'` を使わない（001 の research.md の R12 と同じ）。`/resume/{slug}` とその下の経路の応答に、`src/proxy.ts` が次のヘッダを付ける。限定公開用か公開用かは D1 を読むまで分からないため、経路の形で付ける。公開用（tasks.md の T069）でこのヘッダを外すかは公開用を足すときに決める
  - `Cache-Control: no-store, must-revalidate`（FR-015・NFR-09）
  - `X-Robots-Tag: noindex`（FR-015）。Google は PDF のような HTML でない応答にも X-Robots-Tag が効くとする（[Robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)、2026-11-04 に確認）
  - `Referrer-Policy: no-referrer`（R5）
- 404 は `src/proxy.ts` が描画の前に決め、`/resume/{slug}/missing` へ rewrite する。判定には R6 の取り出しと同じ条件を使う
- 限定公開用のページの `<title>` と OGP に、職務経歴書の中身を出さない（ADR-0024 の「限定公開のページのカードには中身を出さない」）
- `wrangler.jsonc` の `cache`（vinext の CDN キャッシュ）が限定公開用の応答を持たないことを、結合の検査で `Cache-Control` を見て確かめる
- 退けた案: `robots.txt` に `/resume/` を載せる。W3C の Capability URLs は載せるよう勧めるが、Google は `robots.txt` でクロールを止めたページの noindex を読まないとする（上の Robots meta tag）。ADR-0024 も `robots.txt` を遮断に使わないとする

## R8 同時編集の楽観ロック

- 決めたこと: 001 の research.md の R7 と同じ形を、`resume.updated_at` で行う。職務経歴書の中の書き込み（設定・状態・写した行・上書き）はすべて、`UPDATE resume SET …, updated_at = ?新しい値 WHERE id = ? AND updated_at = ?開いたときの値` を `batch()` の先頭に置く。写した行の文は `WHERE EXISTS (SELECT 1 FROM resume WHERE id = ? AND updated_at = ?新しい値)` を付ける
- 理由: FR-038 は職務経歴書を単位にする。写した行は `updated_at` を持たない（migration 0006）
- 帰結: 同じ職務経歴書の別の行を 2 つのタブで直しても、後の保存は止まる

## R9 削除の順序

- 決めたこと: 1 つの `batch()` で、`resume_project_skill`（その職務経歴書の写した実績のもの）→ `resume_project` → `resume_career` → `resume_education` → `resume_skill_override` → `resume` の順に消す
- 理由: 外部キーはすべて NO ACTION（001 の research.md の R8）

## R10 プロフィールとメールアドレス

- 決めたこと: プロフィールは `src/features/resume/domain/profile.ts` の定数に置く。メールアドレスはコードに書かず、Worker の環境変数から読み、型は `src/shared/server/env.ts` に足す。プロフィールは写さず、職務経歴書のページを作るたびに読む（FR-034・FR-036）
- メールアドレスが欠ければ、メールアドレスを出さずにほかを出す（constitution IV）
- 項目は氏名・自己紹介・メールアドレス（plan.md の U6）。氏名と自己紹介の値は `profile.ts` の定数、メールアドレスは環境変数 `RESUME_EMAIL`。どちらもオーナーが入れる
- スパム対策: Cloudflare の Email Address Obfuscation は、Worker が加えた HTML には効かないと公式に書かれている。「Email Obfuscation will not apply in the following cases:」に「The HTML/JavaScript code is specifically added by a Worker.」と `Cache-Control: no-transform` がある（[Email Address Obfuscation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/)、2026-11-04 に確認）。vinext が Worker の中で描く HTML もこれに当たると読める（解釈。確かめていない）
- 未決: 本番の応答で効くかを確かめ、効かなければ別の方法を決める（plan.md の U8）。止める範囲は、メールアドレスを訪問者に出すこと。確かめられるのは本番だけで、Preview は全体が Access の後ろにある

## R11 PDF を作る仕組み

- 決めたこと: 訪問者のブラウザの印刷機能で PDF にする。職務経歴書のページに印刷用の CSS（`@media print`）を付け、「PDF で保存」のボタンで `window.print()` を呼ぶ。サーバーは PDF を作らず、PDF の経路（`/pdf`）を持たない。印刷するのは表示しているページそのもので、中身は表示と同じ値になる（FR-029・FR-030）
- 理由: オーナーの指示「一番シンプルで早い方法で。あとから変えてもいい」（2026-11-04）。package も binding も費用のかかる処理も足さない（constitution II・IX）
- 帰結:
  - ファイルを作るのは訪問者のブラウザで、「PDF に保存」の宛先を持つブラウザに頼る。FR-029 の「PDF のファイルとしてダウンロードできる」は、訪問者が印刷の画面で PDF に保存する操作で満たす
  - 印刷の見た目は `@media print` が決める。ボタンと、ページの外へのリンクは印刷に載せない
  - 公開用の PDF に隠す値が無いこと（SC-002）は、ページの応答の検査で確かめる。印刷はページの DOM だけを使う
- 退けた案:
  - Cloudflare Browser Run の Quick Actions の PDF を Worker の binding から呼ぶ（[PDF endpoint](https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/)、2026-11-04 に確認）。日本語のフォントを持ち、サーバーでファイルを作れるが、費用のかかる処理の要求の上限の値（constitution II）と、Workers Free と Paid のどちらで使うかを先に決める必要がある（[Limits](https://developers.cloudflare.com/browser-rendering/limits/)・[Pricing](https://developers.cloudflare.com/browser-rendering/pricing/)）。サーバーで PDF を作る形に変えるときの第一の候補
  - JavaScript だけで PDF を作るライブラリ（pdf-lib・jsPDF・@react-pdf/renderer）。どれも Workers で動くと書いた公式の資料を見つけられなかった。日本語のフォントを Worker に入れる必要がある（[pdf-lib](https://pdf-lib.js.org/)、[jsPDF](https://github.com/parallax/jsPDF)、[react-pdf の互換性](https://react-pdf.org/compatibility)、2026-11-04 に確認）

## R12 経験年数とスキルの一覧

- 決めたこと: 職務経歴書のスキルの一覧は、写した実績の `resume_project_skill.skill_name` を集め、同じ名前を 1 つにまとめる（FR-026）。経験年数は、名前ごとに、その名前を持つ写した実績の期間を `src/shared/domain/period.ts` の計算に渡して求める。`resume_skill_override` に名前があれば、その月数を使う（FR-027・FR-028）。求めた値は保存しない
- 求める日は、ページを作る要求の日
- 計算の数え方は 001 の FR-033（plan.md の U3）。未決: 名前の比べ方（大文字と小文字を区別するか）は plan.md の U11。写し元の `skill.name` は `COLLATE NOCASE` で重複を拒むが、写した `skill_name` は区別して比べる列で、オーナーが職務経歴書の中で直せる（FR-031）

## R13 本文と画像

- 決めたこと: 写した本文は `description` の文字列で持ち、001 と同じ書式で表示する
- 未決: 本文の書式（001 の U4）、本文の画像（001 の U5 と、spec の「写し元を削除したあとにどう扱うか」）、伏せた見た目（001 の U7）。plan.md の U4・U5
- 本文の画像の行（`media`）の持ち主の列は、職歴・実績・note・activity だけで、職務経歴書を持ち主にできない（migration 0005）

## R14 作ったあとに足す

- 決めたこと: 設定の画面の職歴・実績・学歴の各見出しの下に、足す画面へのリンクを置く。行が 0 件でも出す。足す画面は種類ごとに `/dash/resumes/{uid}/<種類>/new` に置き、作成の画面と同じ選択の部品（`src/features/resume/components/resume-source-fieldset.tsx`）を使う。写し方は作成と同じ `build-resume.ts` を通し、R4 と同じく読む → 計算 → 書くの順にする（FR-041）
- 既に写した元の行（写した行の `career_id`・`project_id`・`education_id` が指す行）は、選択肢から外す。理由: 同じ元の行をもう一度写すと、元の値で写し直すことと同じになる。写し直す機能は spec の「決定が無く」に残っている。外さずに写し済みと示す形は、選べない行を並べるだけで、選ぶ操作に要らない。送られた id に写し済みの行があれば、足さずに知らせる
- 写し元を消した写した行（`*_id` が NULL）は写し済みに数えない。消した元の行は選択肢にも出ない
- 選択肢は何も選ばない状態で始める。理由: 作成の画面がすべてを選んで始める（FR-005）のは、作る時点で載せないものを外すためである。足す画面の選択肢は写していない行だけで、すべてを選んで始めると、外し忘れた行が足される。何も選ばずに送れば、足さずに知らせる
- 楽観ロック: R8 と同じ形にする。`UPDATE resume SET updated_at = ?新しい値 WHERE id = ? AND updated_at = ?開いたときの値` を `batch()` の先頭に置き、写した行の `INSERT … SELECT` に `WHERE EXISTS (SELECT 1 FROM resume WHERE id = ? AND updated_at = ?新しい値)` を付ける。足すと更新日時が変わるため、同じ足す画面を 2 つのタブで開くと、後から送った側は止まる
- 選んだ元の行が足す前に消えていたら、作成と同じく何も書かずに知らせ、選んだ状態を残す（`source-missing`）
- 写した経験年数の上書き: 足す実績のスキルのうち、元のスキルが上書きを持つものを、作成と同じ規則（名前ごとに 1 つ）で集める。職務経歴書に同じ名前の上書きが既にあれば入れない（`ON CONFLICT DO NOTHING`）。理由: 既にある上書きは、作ったときに写した値か、オーナーが職務経歴書の中で直した値（FR-031）で、足す操作がそれを書き換えると FR-032 の「職務経歴書の中で直した値」が消える
- D1 の変更は要らない。写した行の表に行を足すだけで、列も制約も変えない
- 退けた案: 足す画面を 1 つにまとめ、職歴・実績・学歴を同じ画面で選ぶ。設定の画面の各見出しから入る導線と、選んだ種類だけを示す画面の方が、何を足すかが画面の題で分かる

## R15 一度に写す行の上限

- 決めたこと: 作成（`createResume`）と作ったあとに足す操作（`addResumeRows`）で、1 回に写す行を 1000 行までにする（`src/features/resume/domain/build-resume.ts` の `MAX_COPIED_ROWS`）。数えるのは、写した職歴・実績・学歴・実績のスキル・経験年数の上書きの行の合計である。D1 の文は 1 行ごとに 1 つで、すべてを 1 つの `batch()` に積む。上限を超えたら何も書かず、作成と同じく選んだ状態を残して知らせる（`too-many`）。選んだ写し元の数だけで上限を超えるときは、D1 を読む前に止める
- 理由: 量に上限を設ける（docs/SOFTWARE_DESIGN.md の設計原則 2）。D1 の公式の制限（[Limits](https://developers.cloudflare.com/d1/platform/limits/)、2026-10-30 更新の版を 2026-11-08 に確認）は、1 回の Worker の呼び出しの問い合わせ数を Workers Free で 50、Workers Paid で 1000 とし、`batch()` は文の数に関わらず 1 回と数える。文ごとの制限（100 KB・束縛する値 100 個）は `batch()` の中の各文に掛かり、`batch()` の全体は 30 秒で終わる必要がある。したがって D1 は 1 つの `batch()` の文の数を定めず、上限は synsk.me が決める。値は、D1 が 1 回の呼び出しに許す問い合わせの数のうち大きい方（Workers Paid の 1000）に合わせた。写す行の数は職歴・実績・学歴の登録の数で決まり、1000 行は個人の職務経歴書が写す行を上回る（推測。登録の数は数えていない）
- 退けた案: 上限を Workers Free の 50 にする。`batch()` は 1 回と数えるため D1 の制限に当たらず、実績のスキルを合わせると 1 つの職務経歴書が 50 行を超えうる
- 退けた案: 上限を超えた分を複数の `batch()` に分けて書く。`batch()` は 1 つずつがトランザクションで、分けると途中で失敗したときに一部だけ写った職務経歴書が残る（R8 の楽観ロックも 1 つの `batch()` を前提にする）
