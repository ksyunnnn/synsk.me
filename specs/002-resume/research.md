# Research: 職務経歴書

plan.md の Technical Context の不明点と、使う道具の決め方を置く。各項目は「決めたこと・理由・退けた案」の順に書く。決められないものは「未決」として理由と止める範囲を書く。未決の一覧は plan.md の「未決」が持つ。001 の research.md と同じ決め方をする項目は、001 の項目を指して違いだけを書く。

## Contents

- R1 スキーマの前提
- R2 001 から使うもの
- R3 機能の切り方と URL
- R4 写し方
- R5 限定公開用の鍵
- R6 中身を返す条件
- R7 キャッシュ・検索・404
- R8 同時編集の楽観ロック
- R9 削除の順序
- R10 プロフィールとメールアドレス
- R11 PDF を作る仕組み
- R12 経験年数とスキルの一覧
- R13 本文と画像

---

## R1 スキーマの前提

- 決めたこと: `migrations/0001`〜`0008` を当てたスキーマを前提にする。`migrations/0008_rebuild_career_project_and_resume.sql` はブランチ `feature/72-schema-adjustments` のコミット `465fb59` のもので、feature/72-rebuild に入っている（マージのコミット `ce76e8e`、`git branch --contains 465fb59` で確かめた）。写し方は 0008 の `resume.audience` の注釈を正とし、0006 の `resume_career.organization_name`・`resume_project.title` の注釈は使わない（0008 の冒頭）
- 理由: 0008 が `resume.audience` の既定値 `limited`（FR-003）と `resume_skill_override.months_override`（月数、FR-028）を列に反映する
- 未決: 写した職歴・実績が作ったときに秘匿化していたかを持つ列が無い（data-model.md の「スキーマに無いもの」、plan.md の U2）

## R2 001 から使うもの

- 決めたこと: 002 は次の 001 の部品を、変えずに使う

| 部品 | 置き場 | 002 での使い道 | 001 の状態 |
|---|---|---|---|
| 作り手の判定 | `src/shared/server/author.ts` | 管理画面のページと Server Action の先頭 | 済み（001 の T003） |
| env の読み出し | `src/shared/server/env.ts` | D1・Browser Rendering の binding・メールアドレス | 済み（001 の T002）。002 で型を足す |
| 期間 | `src/shared/domain/period.ts` | 写した期間の検証と、経験年数の計算 | 期間の検証は済み（001 の T015）。経験年数は 001 の T061（U6 が解けてから） |
| 入力の部品 | `src/shared/components/field.tsx` | 管理画面の入力 | 済み（001 の T022） |
| Server Action の結果の型 | `src/shared/domain/action-result.ts` | 管理画面の Server Action | 済み（001 の T023） |
| 404 と 403 の判定 | `src/proxy.ts` | `/resume/*` と `/dash/resumes/*` を足す | 済み（001 の T005）。`/projects/:slug` は 001 の T034 が足す |
| 管理画面の入口 | `src/app/dash/page.tsx` | 職務経歴書の一覧へのリンクを足す | 済み（001 の T014） |
| 入力中の内容の保持 | `src/shared/components/draft-retention.tsx` | 写した行の編集の画面（REQUIREMENTS.md の FR-14） | 001 の T072 |
| 作り物の行を入れる道具 | `tests/support/career-and-project-rows.ts` | 写し元の行 | 済み（001 の T021） |

- 002 が使わないもの: 個人の組織の定数（`src/shared/domain/organization.ts` の `PERSONAL_ORGANIZATION_ID`）。001 の research.md の R9 は 002 を使い手に挙げるが、002 の spec に個人の組織を見分ける要件は無い
- 002 は 001 の機能（`src/features/project/` など）を import しない（ADR-0026）。写し元の値は、002 の Repository の実装が SQL で読む（001 の research.md の R10）

## R3 機能の切り方と URL

- 決めたこと: `src/features/resume/` に domain・application・components・server を置く。名前は ADR-0027 が挙げる `resume`
- 訪問者の URL: 公開用は `/resume/{slug}`、限定公開用は `/resume/{slug}/{key}`（R5）。PDF は、それぞれの末尾に `/pdf` を足す（R11）
- 理由: ADR-0048 は URL をコレクション名と識別子で表し、職務経歴書に permalink を持たせる。ADR-0048 の Consequences は職務経歴書のコレクション名を `/resume` とする
- `/resume/{slug}/pdf` と `/resume/{slug}/missing` は、限定公開用の `/resume/{slug}/{key}` と同じ深さにある。鍵は 43 文字の base64url（R5）で、`pdf`・`missing` と一致しない
- 管理画面は `/dash/resumes/*`（contracts/dash.md）。001 の `/dash/projects` と同じく複数形にする
- `src/app/resume/page.tsx`（`/resume`）は 002 の spec に要件が無く、002 は触れない。002 は `src/app/resume/[slug]/` の下だけを足す
- 食い違い: ADR-0048 の Decision Outcome は「note と職務経歴書の slug は、題から候補を提示し、作り手が確定させる」とする。spec の FR-037・FR-039 は、識別子を既定で uid とし、限定公開用は書き換えられないとする。plan は spec に従う。ADR を直すかはオーナーが決める（plan.md の U14）

## R4 写し方

- 決めたこと: 作成のユースケースは、読む → 計算 → 書くの順にする（docs/SOFTWARE_DESIGN.md）
  1. 読む: 選んだ id の職歴・実績・学歴を、組織・スキル・上書きとともに 1 回の `batch()` で読む
  2. 計算: `src/features/resume/domain/build-resume.ts` が、限定公開用か公開用かで写す値を選ぶ（data-model.md の「写し方」）
  3. 書く: `resume` と写した行を 1 回の `batch()` で入れる。子の行の `resume_id` は `(SELECT id FROM resume WHERE slug = ?)`、`resume_project_skill.resume_project_id` は `(SELECT id FROM resume_project WHERE resume_id = … AND project_id = ?)` で引く。識別子はアプリケーションが作るため、入れる前に決まっている
- 理由: `batch()` は 1 つのトランザクションで、1 文が失敗すると全体を戻す（001 の research.md の R2）。作りかけの職務経歴書が残らない
- 公開用で秘匿化した職歴・実績の `description`・`url` は写さない（NULL）。spec はどちらでも FR-017 を満たすとし、実装のときに決めるとする。読まない値は応答に混ざらない（ADR-0029、001 の research.md の R5 と同じ考え）。ただし、オーナーが職務経歴書の中で書き足した本文を伏せるには、U2 の列が要る
- 公開用で、秘匿化した職歴・実績が秘匿化した組織名の無い組織を指していたら、作らずに知らせる（constitution II）。001 の FR-001 がこの状態を保存の前に拒むため、起きるのは 001 の決まりの外で D1 を書き換えたときだけ
- 退けた案: `INSERT … SELECT` で写し元から直接写す。写し方の分岐が SQL の CASE に入り、単体で確かめられない

## R5 限定公開用の鍵

- 決めたこと: 鍵は `crypto.getRandomValues` で作った 32 バイト（256 ビット）を base64url にした 43 文字にする。D1 には鍵の SHA-256（`crypto.subtle.digest`）の 16 進を `limited_token_hash` に入れ、鍵の平文を書かない（FR-012）。鍵は URL のパスに置く（`/resume/{slug}/{key}`）
- 比べ方: 識別子で行を読み、送られた鍵のハッシュと `limited_token_hash` を `crypto.subtle.timingSafeEqual` で比べる。一致したときだけ中身を読む（R6）
- 理由:
  - OWASP は、エントロピーの高いランダムな値には速いハッシュで足りるとする。「A fast hash is sufficient for these random verifiers; password hashing algorithms are unnecessary.」、エントロピーは「at least 128 bits of entropy; prefer 160 bits or more」（[Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)、2026-11-04 に確認）
  - Workers は `getRandomValues`・`digest`（SHA-256）・`timingSafeEqual` を持つ。`timingSafeEqual` は長さが違うと例外を投げる（[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、2026-11-04 に確認）。ハッシュは長さが一定のため例外にならない
  - W3C TAG の Capability URLs は、推測できない値にすること・期限を持たせること・https にすることを勧め、値をパスに置く例を示す。文書は 2014-02-18 の First Public Working Draft で、勧告にならない（[Good Practices for Capability URLs](https://www.w3.org/TR/capability-urls/)、2026-11-04 に確認）
- Referer: 限定公開用のページから外へのリンクで鍵を含む URL が漏れないよう、応答に `Referrer-Policy: no-referrer` を付ける（R7）。OWASP は、秘密の値を含む再設定のページに `no-referrer` を勧める（[Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)、2026-11-04 に確認）
- 帰結: 鍵の平文は D1 に無いため、URL を示せるのは作成に成功した応答の中だけになる。失くした URL を作り直す機能は spec に無い（plan.md の U13）
- 退けた案: 鍵を平文で持つ（FR-012 に反する）。パスワードのハッシュ（bcrypt など）を使う（OWASP がランダムな値には要らないとする）。鍵をクエリに置く（W3C の例と違い、比べた資料を確かめていない）

## R6 中身を返す条件

- 決めたこと: 訪問者向けの取り出しは、鍵のほかの条件を SQL の WHERE に入れ、条件に合わなければ行を返さない
  - 公開用: `slug = ? AND audience = 'public' AND status = 'published'`
  - 限定公開用: `slug = ? AND audience = 'limited' AND status = 'published' AND (limited_expires_at IS NULL OR limited_expires_at > ?今の日時)`。返った行の `limited_token_hash` と送られた鍵のハッシュを R5 の方法で比べ、一致したときだけ写した行を読む
- 今の日時はアプリケーションが `new Date().toISOString()` で作る。`limited_expires_at` の CHECK の形（`%Y-%m-%dT%H:%M:%fZ`）と同じため、文字列の比較が日時の比較になる
- 理由: ADR-0029（取り出すときに確かめる）。中身を返さない 4 つの状態（下書き・期限切れ・鍵が合わない・鍵が無い、SC-003）を同じ取り出しで区別なく弾く
- 返さないときの応答は 404 にそろえる。状態を区別して返すと、識別子の有無や期限切れが URL を知らない人に分かる。W3C の Capability URLs も、期限が切れたら 410 か 404 を返すとする（R5）。画面に何を示すかは spec が決めない（plan.md の U10）

## R7 キャッシュ・検索・404

- 決めたこと: 職務経歴書のページと PDF は `'use cache'` を使わない（001 の research.md の R12 と同じ）。限定公開用（`/resume/{slug}/{key}` とその `/pdf`）の応答に、`src/proxy.ts` が次のヘッダを付ける
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

- 決めたこと: プロフィールは `src/features/resume/domain/profile.ts` の定数に置く。メールアドレスはコードに書かず、Worker の環境変数から読み、型は `src/shared/server/env.ts` に足す。プロフィールは写さず、職務経歴書のページと PDF を作るたびに読む（FR-034・FR-036、台帳 12 節）
- メールアドレスが欠ければ、メールアドレスを出さずにほかを出す（constitution IV）
- 未決: プロフィールの項目と値（spec の FR-006 は「氏名・自己紹介・メールアドレスなど」とする。plan.md の U6）
- スパム対策: Cloudflare の Email Address Obfuscation は、Worker が加えた HTML には効かないと公式に書かれている。「Email Obfuscation will not apply in the following cases:」に「The HTML/JavaScript code is specifically added by a Worker.」と `Cache-Control: no-transform` がある（[Email Address Obfuscation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/)、2026-11-04 に確認）。vinext が Worker の中で描く HTML もこれに当たると読める（解釈。確かめていない）。PDF は text/html でないため対象外
- 未決: 本番の応答で効くかを確かめ、効かなければ別の方法を決める（plan.md の U8）。止める範囲は、メールアドレスを訪問者に出すこと（ページと PDF）。確かめられるのは本番だけで、Preview は全体が Access の後ろにある

## R11 PDF を作る仕組み

- 決めたこと: Cloudflare Browser Run（旧名 Browser Rendering）の Quick Actions の PDF を、Worker の binding から呼ぶ。HTML は、訪問者向けの DTO（contracts/visitor-resume.md）から作り、URL ではなく `html` で渡す。PDF の経路（`/resume/{slug}/pdf`・`/resume/{slug}/{key}/pdf`）は Route Handler にし、要求のたびに写した中身から作る（FR-029・FR-030）。作った PDF は保存しない
- 理由:
  - Browser Run は Workers から使える。「Deploy within Cloudflare Workers or connect from any environment via CDP」（[Browser Run](https://developers.cloudflare.com/browser-run/)、2026-11-04 に確認）
  - Quick Actions の PDF は `url` か `html` を受け取り、Worker の binding から `env.BROWSER.quickAction("pdf", …)` で呼べば「No API token is needed」。`pdfOptions` で用紙と余白を指定できる（[PDF endpoint](https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/)、2026-11-04 に確認）。`@cloudflare/puppeteer` の `page.setContent()` と `page.pdf()` も同じことができる（[PDF generation](https://developers.cloudflare.com/browser-run/how-to/pdf-generation/)）が、package が 1 つ増える（constitution IX）
  - 日本語のフォントを持つ。「IPAfont Gothic (Japanese)」「Noto CJK (Chinese, Japanese, Korean)」（[Supported fonts](https://developers.cloudflare.com/browser-run/reference/supported-fonts/)、2026-11-04 に確認）
  - `html` で渡すと、Browser Run が synsk.me を開かずに済む。Browser Run の要求は Cloudflare に bot と判定される（「Browser Run requests are always identified as bot traffic by Cloudflare」、[FAQ](https://developers.cloudflare.com/browser-run/faq/)）。自分の Worker の URL を開けるかは公式の記述を見つけられなかった。限定公開用の鍵を外の要求に載せずに済む
- 置き場: binding（`wrangler.jsonc` の `browser`）は `src/shared/server/env.ts` で読み、Browser Run を呼ぶのは `src/features/resume/server/pdf-renderer.ts` だけにする（constitution VIII）。HTML は同じファイルの外の、DTO を受け取って文字列を返す関数（`src/features/resume/components/resume-print-html.ts`）が作り、値はすべてエスケープする
- 制限と料金（[Limits](https://developers.cloudflare.com/browser-rendering/limits/)・[Pricing](https://developers.cloudflare.com/browser-rendering/pricing/)、2026-11-04 に確認）

  | 項目 | Workers Free | Workers Paid |
  |---|---|---|
  | Browser hours | 10 minutes per day | 10 hours per month, then $0.09 per additional hour |
  | Quick Actions の要求 | 1 every 10 seconds | 30 per second |
  | 同時に動かせるブラウザ | 3 per account | 200 per account |

- 未決（オーナーに確かめる）: constitution II は費用のかかる処理に量と回数の上限の値を求める。PDF の要求の上限（たとえば IP ごと・全体の回数）と、Workers Free と Paid のどちらで使うかが決まっていない。plan.md の U7。止める範囲は PDF の経路
- 実装のときに確かめること: vinext の Route Handler から Browser Run の binding を呼べること（`wrangler dev` では binding に `"remote": true` が要る。[Get started](https://developers.cloudflare.com/browser-run/get-started/)）
- 退けた案:
  - JavaScript だけで PDF を作るライブラリ（pdf-lib・jsPDF・@react-pdf/renderer）。どれも Workers で動くと書いた公式の資料を見つけられなかった。日本語のフォントを Worker に入れる必要がある（[pdf-lib](https://pdf-lib.js.org/)、[jsPDF](https://github.com/parallax/jsPDF)、[react-pdf の互換性](https://react-pdf.org/compatibility)、2026-11-04 に確認）
  - 訪問者のブラウザの印刷で PDF に保存させる。サーバーで PDF のファイルを作らず、FR-029 の「PDF のファイルとしてダウンロードできる」をブラウザの機能に頼ることになる

## R12 経験年数とスキルの一覧

- 決めたこと: 職務経歴書のスキルの一覧は、写した実績の `resume_project_skill.skill_name` を集め、同じ名前を 1 つにまとめる（FR-026）。経験年数は、名前ごとに、その名前を持つ写した実績の期間を `src/shared/domain/period.ts` の計算に渡して求める。`resume_skill_override` に名前があれば、その月数を使う（FR-027・FR-028）。求めた値は保存しない
- 求める日は、ページか PDF を作る要求の日
- 未決: 計算の数え方は 001 の U6（002 の plan.md の U3）。名前の比べ方（大文字と小文字を区別するか）は plan.md の U11。写し元の `skill.name` は `COLLATE NOCASE` で重複を拒むが、写した `skill_name` は区別して比べる列で、オーナーが職務経歴書の中で直せる（FR-031）

## R13 本文と画像

- 決めたこと: 写した本文は `description` の文字列で持ち、001 と同じ書式で表示する
- 未決: 本文の書式（001 の U4）、本文の画像（001 の U5 と、spec の「写し元を削除したあとにどう扱うか」）、伏せた見た目（001 の U7）。plan.md の U4・U5
- 本文の画像の行（`media`）の持ち主の列は、職歴・実績・note・activity だけで、職務経歴書を持ち主にできない（migration 0005）
