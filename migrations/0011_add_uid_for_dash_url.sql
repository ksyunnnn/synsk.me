-- 管理画面の URL に出す識別子 uid を、管理画面で 1 行ずつ開く表に足す。書き方の決まりは
-- 0003 の冒頭にある。足す表は organization・career・project・skill・education・resume・
-- resume_career・resume_project・resume_education。
--
-- 主キーは URL に出さない（ADR-0048）。project.slug と resume.slug は書き換わるため、
-- 管理画面の URL には使わない（specs/001-career-and-project/research.md の R17）。
-- uid は作った後に変えない（末尾のトリガ）。
--
-- uid は DB が入れる。職務経歴書に行を写す文を含め、どの INSERT でも入れ忘れないため。
-- 値は 16 バイトの乱数の 16 進表記（32 文字）で、題や作った順から推測できない。
-- 既にある行には、入れ直すときに DEFAULT が値を入れる。
--
-- NOT NULL と UNIQUE は ALTER TABLE ADD COLUMN で足せず、ADD COLUMN の DEFAULT は式を
-- 取れないため、表を作り直す。行はそのまま移す。作り直し方は 0008 と同じ。行を別の表に
-- 写してから消し、同じ名前で作り直した表に行を入れ直す。子の表から消し、親の表から
-- 入れ直す。指している表（media・project_skill・resume_project_skill・
-- resume_skill_override）は作り直さず、外部キーの検査をトランザクションの終わりに送る。
--
-- DROP TABLE は sqlite_sequence の行も消す。消す前の値を写しておき、入れ直した後に戻す
PRAGMA defer_foreign_keys = on;

CREATE TABLE sequence_copy AS
SELECT name, seq FROM sqlite_sequence
WHERE name IN (
  'organization', 'career', 'project', 'skill', 'education', 'resume',
  'resume_career', 'resume_project', 'resume_education'
);

CREATE TABLE organization_copy AS SELECT * FROM organization;
CREATE TABLE career_copy AS SELECT * FROM career;
CREATE TABLE project_copy AS SELECT * FROM project;
CREATE TABLE skill_copy AS SELECT * FROM skill;
CREATE TABLE education_copy AS SELECT * FROM education;
CREATE TABLE resume_copy AS SELECT * FROM resume;
CREATE TABLE resume_career_copy AS SELECT * FROM resume_career;
CREATE TABLE resume_project_copy AS SELECT * FROM resume_project;
CREATE TABLE resume_education_copy AS SELECT * FROM resume_education;

DROP TABLE resume_education;
DROP TABLE resume_project;
DROP TABLE resume_career;
DROP TABLE resume;
DROP TABLE education;
DROP TABLE skill;
DROP TABLE project;
DROP TABLE career;
DROP TABLE organization;

-- 組織。会社・団体・自営業（個人）を含む。職歴と実績が指し、組織名の表記をぶれさせない
CREATE TABLE organization (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 管理画面の URL に出す識別子。形と入れ方は冒頭のとおり。下の表の uid も同じ
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 組織名の実際の値。直すと、指している職歴と実績に反映する。作った職務経歴書は
  -- 作ったときの値を写して持つので変わらない
  name TEXT NOT NULL UNIQUE,
  -- 秘匿化した組織名。is_masked の職歴と実績を、訪問者と公開用の職務経歴書に出すときに使う。
  -- NULL なら持たない。持たない組織を指す職歴と実績は秘匿化できない
  name_masked TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 職歴。組織にオーナーが所属して働いた履歴。一覧（activity_feed）に 1 行として並ぶ
CREATE TABLE career (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 所属した組織
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  -- 肩書
  role TEXT NOT NULL,
  -- 所属の始まりの日。一覧はこの日で並べる
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  -- 所属の終わりの日。NULL なら所属が続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  -- 説明の本文。画像とそのキャプションも本文の中に置く
  description TEXT,
  url TEXT,
  -- 1 なら、訪問者には organization.name_masked で出し、description を伏せる。
  -- 既定で秘匿化する。秘匿化しないと選んだ職歴だけを 0 にする
  is_masked INTEGER NOT NULL DEFAULT 1 CHECK (is_masked IN (0, 1)),
  -- published はサイトに載せる。draft はサイトに載せず、管理画面と、限定公開用の
  -- 職務経歴書を作るときにだけ使う。is_masked とは別の軸
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 実績。いずれかの組織で担当した仕事・企画と、活動（勉強会の開催・登壇など）。
-- 職歴とは直接つながらない。一覧（activity_feed）に 1 行として並ぶ
CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- その実績を行ったときに所属していた組織。職歴の組織と違うことがある。
  -- 個人開発は、自営業（個人）の組織の行を指す
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  -- application はアプリ、talk は登壇、event はイベント、other はその他。
  -- 値を足すときは、表を作り直す migration を書く
  kind TEXT NOT NULL CHECK (kind IN ('application', 'talk', 'event', 'other')),
  -- 訪問者向けの URL に出す識別子。note.slug と同じ形。オーナーが書き換えられるため、
  -- 管理画面の URL には uid を使う
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  -- 題の実際の値
  title TEXT NOT NULL,
  -- 秘匿化した題。is_masked の実績を、訪問者と公開用の職務経歴書に出すときに使う
  title_masked TEXT NOT NULL,
  -- 1 なら、訪問者には title_masked と organization.name_masked で出し、description を伏せる。
  -- 既定で秘匿化する。秘匿化しないと選んだ実績だけを 0 にする
  is_masked INTEGER NOT NULL DEFAULT 1 CHECK (is_masked IN (0, 1)),
  -- 意味は career.status と同じ
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 代表画像。この実績が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  -- 始まりの日。一覧はこの日で並べる。スキルの経験年数は、実績の期間から求める
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  -- 終わりの日。NULL なら続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  -- 説明の本文。画像とそのキャプションも本文の中に置く。秘匿化した値は持たない
  description TEXT,
  -- 関連 URL。1 件の実績に 1 つ
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- media.project_id もこの表を指すため、検査をトランザクションの終わりに送る。
  -- 実績と画像を同じトランザクションで消せるようにするため
  FOREIGN KEY (id, card_media_id) REFERENCES media (project_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- スキル。project_skill で実績につなぐ。職歴のスキルは、同じ組織で期間が重なる実績の
-- スキルを合わせて求める
CREATE TABLE skill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 大文字と小文字の違いだけの重複を拒む（TypeScript と typescript）。重複すると、
  -- 経験年数が 2 行に分かれて計算される
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  -- 経験年数を手で上書きする値で、月数で持つ（5 年 11 か月は 71）。年と月に分けて
  -- 見せるのは表示の側。NULL なら、そのスキルを付けた実績の期間をつなぎ、
  -- 重なりを除いた長さから求めた値を使う。求めた値は保存しない
  months_override INTEGER CHECK (months_override IS NULL OR months_override >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 学歴。職務経歴書を通してだけ出す
CREATE TABLE education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  school TEXT NOT NULL,
  department TEXT,
  -- 始まりの日
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  -- 終わりの日。NULL なら続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 職務経歴書の版。複数持つ。限定公開用は提出先ごとに作って渡し、公開用はサイトで公開する
CREATE TABLE resume (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 訪問者向けの URL に出す識別子。note.slug と同じ形。限定公開用は、題や提出先から推測
  -- できない uid をアプリケーションが入れ、URL を開く鍵を兼ねる。出し直すと新しい uid に
  -- 書き換わり、古い URL は読めなくなる。書き換わるため、管理画面の URL には uid を使う
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL,
  -- limited は限定公開用で、職歴と実績をすべて実際の値で写す。public は公開用で、
  -- 職務経歴書を作ったときに秘匿化していた職歴と実績は秘匿化した値を、それ以外は実際の値を写す。
  -- 既定は limited。作った後に変えない（下のトリガ）
  audience TEXT NOT NULL DEFAULT 'limited' CHECK (audience IN ('limited', 'public')),
  -- draft は下書き、published は読み手に見せる
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
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
  -- 公開用は期限を持たない
  CHECK (audience = 'limited' OR limited_expires_at IS NULL)
) STRICT;

-- 職務経歴書に写した職歴。写し方は 0006 の冒頭のとおり
CREATE TABLE resume_career (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  -- 写し元の職歴
  career_id INTEGER REFERENCES career (id),
  -- その職務経歴書で使う方の組織名。写し方は resume.audience の注釈のとおり
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
  url TEXT,
  -- 職務経歴書を作ったときの、写し元の職歴の career.is_masked を写す。意味は 0008 の注釈のとおり
  is_masked INTEGER NOT NULL DEFAULT 1 CHECK (is_masked IN (0, 1))
) STRICT;

-- 職務経歴書に写した実績
CREATE TABLE resume_project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  -- 写し元の実績
  project_id INTEGER REFERENCES project (id),
  -- その職務経歴書で使う方の組織名。写し方は resume_career.organization_name と同じ
  organization_name TEXT NOT NULL,
  -- 値の意味は project.kind と同じ
  kind TEXT NOT NULL CHECK (kind IN ('application', 'talk', 'event', 'other')),
  -- その職務経歴書で使う方の題。写し方は resume.audience の注釈のとおり
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
  url TEXT,
  -- 職務経歴書を作ったときの、写し元の実績の project.is_masked を写す。意味は 0008 の注釈のとおり
  is_masked INTEGER NOT NULL DEFAULT 1 CHECK (is_masked IN (0, 1))
) STRICT;

-- 職務経歴書に写した学歴
CREATE TABLE resume_education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
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

-- 親の表から入れ直す。uid は列に挙げず、DEFAULT が入れる
INSERT INTO organization (id, name, name_masked, created_at, updated_at)
SELECT id, name, name_masked, created_at, updated_at FROM organization_copy;

INSERT INTO career (
  id, organization_id, role, started_on, ended_on, description, url, is_masked, status,
  created_at, updated_at
)
SELECT
  id, organization_id, role, started_on, ended_on, description, url, is_masked, status,
  created_at, updated_at
FROM career_copy;

INSERT INTO project (
  id, organization_id, kind, slug, title, title_masked, is_masked, status, card_media_id,
  started_on, ended_on, description, url, created_at, updated_at
)
SELECT
  id, organization_id, kind, slug, title, title_masked, is_masked, status, card_media_id,
  started_on, ended_on, description, url, created_at, updated_at
FROM project_copy;

INSERT INTO skill (id, name, months_override, created_at, updated_at)
SELECT id, name, months_override, created_at, updated_at FROM skill_copy;

INSERT INTO education (
  id, school, department, started_on, ended_on, remarks, created_at, updated_at
)
SELECT id, school, department, started_on, ended_on, remarks, created_at, updated_at
FROM education_copy;

INSERT INTO resume (
  id, slug, title, audience, status, limited_expires_at, created_at, updated_at
)
SELECT
  id, slug, title, audience, status, limited_expires_at, created_at, updated_at
FROM resume_copy;

INSERT INTO resume_career (
  id, resume_id, career_id, organization_name, role, started_on, ended_on, description, url,
  is_masked
)
SELECT
  id, resume_id, career_id, organization_name, role, started_on, ended_on, description, url,
  is_masked
FROM resume_career_copy;

INSERT INTO resume_project (
  id, resume_id, project_id, organization_name, kind, title, started_on, ended_on,
  description, url, is_masked
)
SELECT
  id, resume_id, project_id, organization_name, kind, title, started_on, ended_on,
  description, url, is_masked
FROM resume_project_copy;

INSERT INTO resume_education (
  id, resume_id, education_id, school, department, started_on, ended_on, remarks
)
SELECT id, resume_id, education_id, school, department, started_on, ended_on, remarks
FROM resume_education_copy;

DELETE FROM sqlite_sequence
WHERE name IN (
  'organization', 'career', 'project', 'skill', 'education', 'resume',
  'resume_career', 'resume_project', 'resume_education'
);

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE organization_copy;
DROP TABLE career_copy;
DROP TABLE project_copy;
DROP TABLE skill_copy;
DROP TABLE education_copy;
DROP TABLE resume_copy;
DROP TABLE resume_career_copy;
DROP TABLE resume_project_copy;
DROP TABLE resume_education_copy;

-- 索引とトリガは DROP TABLE で消えるため、0006・0008・0010 と同じものを作り直す
CREATE INDEX career_organization_id ON career (organization_id);

CREATE INDEX project_organization_id ON project (organization_id);

CREATE INDEX resume_career_resume_id ON resume_career (resume_id);
CREATE INDEX resume_career_career_id ON resume_career (career_id);

CREATE INDEX resume_project_resume_id ON resume_project (resume_id);
CREATE INDEX resume_project_project_id ON resume_project (project_id);

CREATE INDEX resume_education_resume_id ON resume_education (resume_id);
CREATE INDEX resume_education_education_id ON resume_education (education_id);

CREATE TRIGGER organization_updated_at
AFTER UPDATE ON organization
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE organization SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER career_updated_at
AFTER UPDATE ON career
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE career SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER project_updated_at
AFTER UPDATE ON project
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE project SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER skill_updated_at
AFTER UPDATE ON skill
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE skill SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER education_updated_at
AFTER UPDATE ON education
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE education SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- 公開用の職務経歴書は 1 つだけ
CREATE UNIQUE INDEX resume_public ON resume (audience) WHERE audience = 'public';

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

-- uid を書き換えると、開いている管理画面の URL が別の行を指すか、どの行も指さなくなる
CREATE TRIGGER organization_uid_fixed
BEFORE UPDATE OF uid ON organization
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'organization_uid_fixed');
END;

CREATE TRIGGER career_uid_fixed
BEFORE UPDATE OF uid ON career
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'career_uid_fixed');
END;

CREATE TRIGGER project_uid_fixed
BEFORE UPDATE OF uid ON project
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'project_uid_fixed');
END;

CREATE TRIGGER skill_uid_fixed
BEFORE UPDATE OF uid ON skill
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'skill_uid_fixed');
END;

CREATE TRIGGER education_uid_fixed
BEFORE UPDATE OF uid ON education
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'education_uid_fixed');
END;

CREATE TRIGGER resume_uid_fixed
BEFORE UPDATE OF uid ON resume
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'resume_uid_fixed');
END;

CREATE TRIGGER resume_career_uid_fixed
BEFORE UPDATE OF uid ON resume_career
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'resume_career_uid_fixed');
END;

CREATE TRIGGER resume_project_uid_fixed
BEFORE UPDATE OF uid ON resume_project
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'resume_project_uid_fixed');
END;

CREATE TRIGGER resume_education_uid_fixed
BEFORE UPDATE OF uid ON resume_education
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'resume_education_uid_fixed');
END;
