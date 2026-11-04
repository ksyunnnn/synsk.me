-- 職歴と実績に、サイトに載せるかを表す status を足す。life event に、個別のページの URL に
-- 出す識別子 slug を足す。書き方の決まりは 0003 の冒頭にある。
--
-- どちらも既定値か NULL を持てるため、表を作り直さず ALTER TABLE で足す

-- 名前と値は note.status・resume.status と同じ（ADR-0043）。published はサイトに載せる。
-- draft はサイトに載せず、管理画面と、限定公開用の職務経歴書を作るときにだけ使う。
-- is_masked とは別の軸で、published の行を実際の値で出すか秘匿化した値で出すかを
-- is_masked が決める。この列を足す前の行は draft になる
ALTER TABLE career
ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

ALTER TABLE project
ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- life event の個別のページの URL に出す識別子。形は project.slug と同じ。既定の値は、
-- 題や起きた日から推測できない uid をアプリケーションが入れる。オーナーは書き換えられる。
-- 主キーは URL に出さない。
-- life event だけが持ち、外部から取り込んだ行は NULL。life event の見分け方は 0004 の
-- activity の CHECK と同じく source = 'life_event' で、表をまたがない。
-- ADD COLUMN の CHECK は既にある行でも確かめるため、slug を持たない life event の行が
-- あれば、この migration は失敗する
ALTER TABLE activity
ADD COLUMN slug TEXT CHECK (
  (source = 'life_event') = (slug IS NOT NULL)
  AND (
    slug IS NULL
    OR (length(slug) BETWEEN 1 AND 100 AND slug NOT GLOB '*[^a-z0-9-]*')
  )
);

-- life event どうしで識別子を重ねない。外部から取り込んだ行の NULL は数えない
CREATE UNIQUE INDEX activity_slug ON activity (slug) WHERE slug IS NOT NULL;
