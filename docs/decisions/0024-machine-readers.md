---
status: accepted
date: 2026-09-13
decision-makers: synsk
consulted: Claude
---

# 機械の読み手を歓迎し、キャッシュで受ける

## Context and Problem Statement

synsk.me は note、timeline、職務経歴書を公開する。公開すれば、人間の読者に加えてクローラーとエージェントが取得に来る。2026-09-13 の時点で、機械の読み手にどう振る舞うかを定めた記録も要件もなかった。

2026-09-11 から 2026-09-13 に調べて分かった事実は次のとおり。出典は More Information に並べる。

- AI 事業者は、取得の目的ごとに別の名前でクローラーを出している。OpenAI は学習に `GPTBot`、検索に `OAI-SearchBot`、利用者の代理による取得に `ChatGPT-User` を使う
- RFC 9309 は「These rules are not a form of access authorization.」と定める
- 利用者の代理で取得するクローラーには `robots.txt` を適用しないと、Google、OpenAI、Perplexity、Meta が公式に書いている
- Google は、`Google-Extended`（学習）が検索への掲載とランキングに影響しないと明記している。学習を拒むことの利点を示す一次ソースは見つからなかった
- Google は `llms.txt` を検索で使わないと明記している。読むと表明した AI 事業者は見つからなかった
- ゾーン `synsk.me` のプランは Cloudflare の Free Website である（2026-09-13 に Cloudflare API の `GET /zones` で確認）。Workers のプランは、同じ API トークンで読める範囲に含まれず確認できなかったため、Workers Free の上限で見積もる。Workers Free は1日 100,000 リクエストまでで、超えると Error 1027 を返す
- Workers Cache に当たった取得は、Worker を実行せずに返る

## Decision Drivers

* AI に問われたときに synsk.me が紹介されること。2026-09-13 にオーナーが目的として定めた
* 機械の読み手に対して、意図を明示し礼儀正しくあること
* Workers Free と Cloudflare Free Website の上限の中で公開を続けられること
* 限定公開のコンテンツを、URL を知らない者に渡さないこと

## Considered Options

* 取得を拒む
* 学習だけを拒み、検索と引用は許す
* 取得と引用を歓迎する

## Decision Outcome

**公開しているコンテンツの取得と引用を、目的を問わず歓迎する。取得の負荷はキャッシュで受け、限定公開は `robots.txt` ではなく URL で守る。**

紹介されるには、検索用のクローラーが取得できることが前提になる。学習を拒むことの利点を示す一次ソースはなく、利用者の代理による取得は `robots.txt` で止められない。

### 取得を許す相手

- `robots.txt` は許可を示すために書き、遮断には使わない。遮断は Cloudflare の層で行う。`robots.txt` は守られる保証がないため
- なりすましの判定は Cloudflare の検証済みボットに委ねる。AI クローラーを名乗るトラフィックの 5.7%、ChatGPT を名乗るものの 16.7% がなりすましであるという観測（Human Security の集計）があり、歓迎しても判定は要る

### 取らせないもの

- 限定公開は、推測しにくい URL を知る人に開く。検討したのは、Cloudflare Access の認証で閉じる、URL を知る人に開く、職務経歴書ごとに使い分ける、の3つ。渡す手間の少なさを採る。URL の流出と利用者の代理による取得には、期限などを設けて備える
- 配信する値は許可リスト方式で選ぶ。ADR-0008 の Consequences が、除外リスト方式ではカラムが増えたときに漏れると指摘しているため

### 差し出し方

- `sitemap.xml` を置く。生成の手間がほぼなく、どこからもリンクされていない新しい note が見つかるまでの時間を縮めるため
- Atom フィードを出す。検討したのは、RSS、Atom、両方、の3つ。2026-09-13 に確認した個人サイト14件は、すべてフィードを持ち、形式は割れている。日付の書き方が1つに定まっている Atom を採る
- `llms.txt` を置き、HTML のページを指す。効果を示すデータはないが、差し出す姿勢を示すために置く。Markdown 版は、同じ内容の URL が2つに増えることと、本文の抜き出しに困る構造ではないことから出さない
- API は用意しない。確認した個人サイトに、公開している例がない
- 構造化データは、AI の読み手のためには足さない。Google が生成 AI 検索に不要と明記しており、Ahrefs の差の差分析（処置 1,885 件、対照 4,000 件）でも AI Overviews での引用が 4.6% 減っている
- カード画像は note ごとに、題を入れた自動生成、note に追加した画像、サイト共通のアイキャッチから選び、既定を自動生成とする。検討したのは、note ごとに作る、サイト共通の1枚、画像なし、の3つ。リンクが貼られたときに note ごとの区別がつくことを採る。画像の有無が紹介に効くかは調べていない
- 限定公開のページのカードには中身を出さない。リンクのプレビューを作るクローラーのうち、Meta の `facebookexternalhit` と Google の `GoogleMessages` は `robots.txt` を適用しないと公式に書かれており、チャットに貼られた URL のカードは居合わせた全員に見えるため

### 取得の後の利用

- 学習、AI の回答への投入、検索のいずれにも使ってよいと明示し、出典とリンクを要望する。検討したのは、許可の明示のみ、許可に出典の要望を添える、何も主張しない、の3つ。何も書かない状態は Content Signals Policy が「許可も制限も与えていない」と定義しており、意図して開いていることを示す方が、礼儀正しくあるという目的に沿う

### 取得の負荷

- 公開しているコンテンツはキャッシュから返す。キャッシュに当たった取得は Worker を実行しないため、取得の量が Workers と D1 の無料枠を消費しない
- レート制限ルールを1本置く。Free で置けるのは1本で、IP 単位で数え、計数期間と遮断はともに10秒である
- Bot Fight Mode は使わない。WAF のルールで例外を作れず、歓迎するクローラーを巻き込まないことを保証できないため
- 検討したのは、キャッシュ、レート制限ルール、AI Crawl Control のブロック、Bot Fight Mode、の4つ

### Consequences

* Good, because 検索用のクローラーの取得を妨げず、AI の回答で紹介される前提を満たす
* Good, because 取得の大半がキャッシュから返り、Workers と D1 の無料枠をほぼ消費しない
* Bad, because 学習に使われることを止めない
* Bad, because 出典の要望に従うと表明した AI 事業者は、2026-09-13 の調査の範囲にない。要望に強制力はない
* Bad, because 限定公開の URL が流出すれば、URL を知った者と、その代理で取得するクローラーには見える
* Bad, because 題を入れたカード画像を作る処理が、Workers Free の CPU 時間（1リクエスト 10ms）に収まるかを確かめていない
* Bad, because Free の AI Crawl Control は直近24時間分しか表示せず、取得の量の推移を追えない

### Confirmation

次の手段で判定する。

- `https://synsk.me/robots.txt` が、AI クローラーを名指しした `Disallow` を持たず、学習・AI の回答への投入・検索の許可を明示している
- `sitemap.xml`、Atom フィード、`llms.txt` が 200 を返し、限定公開の URL を含まない
- 同じ note を2回取得すると、2回目が `cf-cache-status: HIT` を返す。取得にはブラウザ相当のヘッダを付ける（ADR-0018）
- Cloudflare API で、ゾーンの Bot Fight Mode が無効であり、レート制限ルールが1本あることを確かめる
- 限定公開のページの `og:title`、`og:description`、`og:image` が中身を含まない

## Pros and Cons of the Options

### 取得を拒む

* Good, because 学習と引用に使われることを、表明の上では止められる
* Bad, because 検索用のクローラーも止まり、AI の回答で紹介される前提を失う
* Bad, because 利用者の代理による取得は `robots.txt` で止まらず、なりすましたクローラーも観測されている

### 学習だけを拒み、検索と引用は許す

* Good, because 紹介される前提を保ちながら、学習への利用を拒むと表明できる。事業者が目的別に名前を分けているため、`robots.txt` に書き分けられる
* Neutral, because Google は `Google-Extended` が検索に影響しないと明記しており、紹介されやすさは変わらない
* Bad, because 学習を拒むことの利点を示す一次ソースが見つからなかった

### 取得と引用を歓迎する — 採用

* Good, because 紹介される前提を満たし、意図を明示できる
* Bad, because 学習への利用を止めない
* Bad, because 取得の量が増えうる。キャッシュで受けることが前提になる

## More Information

クローラーと取得の扱い

- [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309)
- [OpenAI: Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)
- [Google: Google's common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)
- [Google: Google's user-triggered fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers)
- [Perplexity: Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- [Meta: Meta Web Crawlers](https://developers.facebook.com/docs/sharing/webmasters/crawler)
- [nohacks.co: AI user agents landscape 2026](https://nohacks.co/blog/ai-user-agents-landscape-2026)（Human Security の集計を掲載した二次情報）

検索と AI 回答での扱い

- [Google: AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Ahrefs: Does schema markup help AI citations?](https://ahrefs.com/blog/schema-ai-citations/)
- [Cloudflare: Content Signals Policy](https://blog.cloudflare.com/content-signals-policy/)

Cloudflare の上限と機能

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Cache](https://developers.cloudflare.com/workers/cache/)
- [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/)

フィードの確認対象（2026-09-13 に各サイトへ HTTP GET して確認）: catnose.me、zenn.dev、overreacted.io、simonwillison.net、jvns.ca、adactio.com、daringfireball.net、danluu.com、efcl.info、blog.jxck.io、mizchi.dev、kentcdodds.com、tantek.com、aaronparecki.com

関連する決定の記録

- [ADR-0008: コンテンツの可視性を3段階で扱う](./0008-content-visibility.md)
- [ADR-0018](./0018-vinext-runtime.md)
- [ADR-0023: synsk.me が持つ記事を note と呼ぶ](./0023-note-naming.md)
