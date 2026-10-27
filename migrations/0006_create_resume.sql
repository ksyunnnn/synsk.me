-- 職務経歴書の表を作る（#72 の ER 図）。書き方の決まりは 0003 の冒頭にある。
--
-- 職務経歴書は、作ったときの職歴・実績・学歴の中身を写して持つ。元の行を書き換えても、
-- 渡した職務経歴書の中身は変わらない。写した行は、その職務経歴書だけのものなので
-- どの列も直せる。写した行の *_id は元の行を指すが、空でもよい。
-- 写すのは選んだ職歴・実績・学歴だけ。職務経歴書の中では started_on の新しい順に並べる

-- 職務経歴書の版。複数持つ。限定公開用は提出先ごとに作って渡し、公開用はサイトで公開する
CREATE TABLE resume (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- URL に出す識別子。note.slug と同じ形
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL,
  -- limited は限定公開用で、is_masked の職歴と実績も実際の値で載せる。
  -- public は公開用で、秘匿化した値で載せる。作った後に変えない（下のトリガ）
  audience TEXT NOT NULL CHECK (audience IN ('limited', 'public')),
  -- draft は下書き、published は読み手に見せる
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 限定公開用の URL の鍵のハッシュ。DB が漏れても URL が漏れないよう、平文で持たない
  limited_token_hash TEXT UNIQUE,
  -- 限定公開用の URL の期限。NULL なら期限を設けない。期限が切れたら読めなくなるが、
  -- 行は消さない。期限を延ばせば、もう一度読める
  limited_expires_at TEXT CHECK (
    limited_expires_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', limited_expires_at) IS limited_expires_at
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- 公開用は鍵と期限を持たない
  CHECK (
    audience = 'limited'
    OR (limited_token_hash IS NULL AND limited_expires_at IS NULL)
  )
) STRICT;

-- 公開用の職務経歴書は 1 つだけ
CREATE UNIQUE INDEX resume_public ON resume (audience) WHERE audience = 'public';

-- 職務経歴書に写した職歴
CREATE TABLE resume_career (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  -- 写し元の職歴
  career_id INTEGER REFERENCES career (id),
  -- その職務経歴書で使う方の組織名。限定公開用は organization.name、
  -- 公開用は organization.name_masked を写す
  organization_name TEXT NOT NULL,
  role TEXT NOT NULL,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  description TEXT,
  url TEXT
) STRICT;

CREATE INDEX resume_career_resume_id ON resume_career (resume_id);
CREATE INDEX resume_career_career_id ON resume_career (career_id);

-- 職務経歴書に写した実績
CREATE TABLE resume_project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  -- 写し元の実績
  project_id INTEGER REFERENCES project (id),
  -- その職務経歴書で使う方の組織名。写し方は resume_career.organization_name と同じ
  organization_name TEXT NOT NULL,
  -- 値の意味は project.kind と同じ
  kind TEXT NOT NULL CHECK (kind IN ('application', 'talk', 'event', 'other')),
  -- その職務経歴書で使う方の題。限定公開用は project.title、公開用は project.title_masked を写す
  title TEXT NOT NULL,
  -- 期間は、写したスキルの経験年数を求めるのにも使う
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  description TEXT,
  url TEXT
) STRICT;

CREATE INDEX resume_project_resume_id ON resume_project (resume_id);
CREATE INDEX resume_project_project_id ON resume_project (project_id);

-- 職務経歴書に写した学歴
CREATE TABLE resume_education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  -- 写し元の学歴
  education_id INTEGER REFERENCES education (id),
  school TEXT NOT NULL,
  department TEXT,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  remarks TEXT
) STRICT;

CREATE INDEX resume_education_resume_id ON resume_education (resume_id);
CREATE INDEX resume_education_education_id ON resume_education (education_id);

-- 写した実績で使ったスキル。スキルの名前を写して持つ。職務経歴書のスキルの一覧と
-- 経験年数は、この表と resume_project の期間から求める
CREATE TABLE resume_project_skill (
  resume_project_id INTEGER NOT NULL REFERENCES resume_project (id),
  skill_name TEXT NOT NULL,
  -- 同じスキルを 2 回数えない
  PRIMARY KEY (resume_project_id, skill_name)
) STRICT;

-- 写した経験年数の上書き。上書きしたスキルだけ持つ
CREATE TABLE resume_skill_override (
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  skill_name TEXT NOT NULL,
  -- 写した skill.years_override
  years_override INTEGER NOT NULL,
  -- 1 つのスキルに上書きを 1 つだけ持つ
  PRIMARY KEY (resume_id, skill_name)
) STRICT;

-- 公開用と限定公開用は、載せる値が違う。作った後に入れ替えると、限定公開用に
-- 載せた実際の値が公開用として出る
CREATE TRIGGER resume_audience_fixed
BEFORE UPDATE OF audience ON resume
FOR EACH ROW
WHEN NEW.audience IS NOT OLD.audience
BEGIN
  SELECT RAISE(ABORT, 'resume_audience_fixed');
END;

CREATE TRIGGER resume_updated_at
AFTER UPDATE ON resume
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE resume SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
