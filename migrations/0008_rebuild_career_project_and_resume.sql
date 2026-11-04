-- 組織・職歴・実績・スキル・職務経歴書の列を直す。書き方の決まりは 0003 の冒頭にある。
-- - organization.name_masked を空にできるようにする
-- - career.is_masked と project.is_masked の既定値を 1 にする
-- - project.is_highlighted を外す
-- - skill.years_override を月数の months_override にする。写した resume_skill_override も合わせる
-- - resume.audience の既定値を limited にする
--
-- 0006 の resume_career.organization_name と resume_project.title の注釈は、公開用が常に
-- 秘匿化した値を写すと読める。写し方は、下で作り直す resume.audience の注釈のとおり。
-- resume_career と resume_project は作り直さないため、ここに書く
--
-- NOT NULL・DEFAULT・CHECK は ALTER TABLE で変えられないため、表を作り直す。行はそのまま移す。
-- 外部キーで指されている表の作り直し方は 0007 と同じ。行を別の表に写してから消し、
-- 同じ名前で作り直した表に行を入れ直す。子の表から消し、親の表から入れ直す。
--
-- DROP TABLE は sqlite_sequence の行も消す。入れ直すと、残っている行の id の最大値から
-- 数え直し、消した行の id を使い回す。そこで、消す前の値を写しておき、入れ直した後に戻す
PRAGMA defer_foreign_keys = on;

CREATE TABLE sequence_copy AS
SELECT name, seq FROM sqlite_sequence
WHERE name IN ('organization', 'career', 'project', 'skill', 'resume');

CREATE TABLE organization_copy AS SELECT * FROM organization;
CREATE TABLE career_copy AS SELECT * FROM career;
CREATE TABLE project_copy AS SELECT * FROM project;
CREATE TABLE skill_copy AS SELECT * FROM skill;
CREATE TABLE resume_skill_override_copy AS SELECT * FROM resume_skill_override;
CREATE TABLE resume_copy AS SELECT * FROM resume;

DROP TABLE resume_skill_override;
DROP TABLE resume;
DROP TABLE skill;
DROP TABLE project;
DROP TABLE career;
DROP TABLE organization;

-- 組織。会社・団体・自営業（個人）を含む。職歴と実績が指し、組織名の表記をぶれさせない
CREATE TABLE organization (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  -- その実績を行ったときに所属していた組織。職歴の組織と違うことがある。
  -- 個人開発は、自営業（個人）の組織の行を指す
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  -- application はアプリ、talk は登壇、event はイベント、other はその他。
  -- 値を足すときは、表を作り直す migration を書く
  kind TEXT NOT NULL CHECK (kind IN ('application', 'talk', 'event', 'other')),
  -- URL に出す識別子。note.slug と同じ形
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

-- 職務経歴書の版。複数持つ。限定公開用は提出先ごとに作って渡し、公開用はサイトで公開する
CREATE TABLE resume (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- URL に出す識別子。note.slug と同じ形
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

-- 写した経験年数の上書き。上書きしたスキルだけ持つ
CREATE TABLE resume_skill_override (
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  skill_name TEXT NOT NULL,
  -- 写した skill.months_override
  months_override INTEGER NOT NULL CHECK (months_override >= 0),
  -- 1 つのスキルに上書きを 1 つだけ持つ
  PRIMARY KEY (resume_id, skill_name)
) STRICT;

INSERT INTO organization (id, name, name_masked, created_at, updated_at)
SELECT id, name, name_masked, created_at, updated_at FROM organization_copy;

INSERT INTO career (
  id, organization_id, role, started_on, ended_on, description, url, is_masked,
  created_at, updated_at
)
SELECT
  id, organization_id, role, started_on, ended_on, description, url, is_masked,
  created_at, updated_at
FROM career_copy;

INSERT INTO project (
  id, organization_id, kind, slug, title, title_masked, is_masked, card_media_id,
  started_on, ended_on, description, url, created_at, updated_at
)
SELECT
  id, organization_id, kind, slug, title, title_masked, is_masked, card_media_id,
  started_on, ended_on, description, url, created_at, updated_at
FROM project_copy;

-- 0003 の years_override は年数だったため、12 を掛けて月数にする
INSERT INTO skill (id, name, months_override, created_at, updated_at)
SELECT id, name, years_override * 12, created_at, updated_at FROM skill_copy;

INSERT INTO resume (
  id, slug, title, audience, status, limited_token_hash, limited_expires_at,
  created_at, updated_at
)
SELECT
  id, slug, title, audience, status, limited_token_hash, limited_expires_at,
  created_at, updated_at
FROM resume_copy;

INSERT INTO resume_skill_override (resume_id, skill_name, months_override)
SELECT resume_id, skill_name, years_override * 12 FROM resume_skill_override_copy;

DELETE FROM sqlite_sequence
WHERE name IN ('organization', 'career', 'project', 'skill', 'resume');

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE organization_copy;
DROP TABLE career_copy;
DROP TABLE project_copy;
DROP TABLE skill_copy;
DROP TABLE resume_skill_override_copy;
DROP TABLE resume_copy;

-- 索引とトリガは DROP TABLE で消えるため、0003 と 0006 と同じものを作り直す
CREATE INDEX career_organization_id ON career (organization_id);

CREATE INDEX project_organization_id ON project (organization_id);

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
