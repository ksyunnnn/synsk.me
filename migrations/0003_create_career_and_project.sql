-- 組織・職歴・実績・学歴・スキルの表を作る（#72 の ER 図）。
--
-- 書き方は 0002 に合わせる。
-- - 外部キーは、物理削除のときの扱いを書かない（NO ACTION）。子の行が残っていれば
--   削除はエラーで止まる。表を作り直す migration で、子の行が黙って消えないため
--   （#72 の 2026-10-24 の決定）
-- - id は AUTOINCREMENT にする。削除した行の id を使い回すと、別に開いたままの
--   編集の画面からの保存が、後から作った別の行を上書きする（#72 の 2026-10-26 の決定）
-- - 年月は YYYY-MM、日時は Date.prototype.toISOString() の形（UTC）。
--   形を strftime() で確かめる。読めない値は strftime() が NULL を返すため IS で比べる
-- - created_at と updated_at は DB が入れる。updated_at は行を書き換えたときに
--   トリガーが入れ直す。アプリケーションが入れ忘れないため
-- - 真偽は 0 と 1 の INTEGER

CREATE TABLE organization (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  -- 秘匿化した組織名。is_masked の職歴と実績を、訪問者と公開用の職務経歴書に出すときに使う
  name_masked TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 職歴。組織にオーナーが所属した履歴
CREATE TABLE career (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  role TEXT NOT NULL,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m', started_on || '-01') IS started_on
  ),
  -- NULL なら所属が続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m', ended_on || '-01') IS ended_on AND ended_on >= started_on)
  ),
  description TEXT,
  url TEXT,
  -- 1 なら、訪問者には organization.name_masked で出し、description を伏せる
  is_masked INTEGER NOT NULL CHECK (is_masked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

CREATE INDEX career_organization_id ON career (organization_id);

-- 実績
CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  kind TEXT NOT NULL CHECK (kind IN ('application', 'talk', 'event', 'other')),
  -- note.slug と同じ形
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL,
  -- 秘匿化した題。is_masked の実績を、訪問者と公開用の職務経歴書に出すときに使う
  title_masked TEXT NOT NULL,
  -- 1 なら、訪問者には title_masked と organization.name_masked で出し、description を伏せる
  is_masked INTEGER NOT NULL CHECK (is_masked IN (0, 1)),
  is_highlighted INTEGER NOT NULL CHECK (is_highlighted IN (0, 1)),
  -- カードの画像。この実績が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m', started_on || '-01') IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m', ended_on || '-01') IS ended_on AND ended_on >= started_on)
  ),
  description TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- media は 0005 で作る。media.project_id もこの表を指すため、検査をトランザクションの
  -- 終わりに送る。実績と画像を同じトランザクションで消せるようにするため
  FOREIGN KEY (id, card_media_id) REFERENCES media (project_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE INDEX project_organization_id ON project (organization_id);

-- 学歴。職務経歴書を通してだけ出す（#72 の 2026-10-26 の決定）
CREATE TABLE education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school TEXT NOT NULL,
  department TEXT,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m', started_on || '-01') IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m', ended_on || '-01') IS ended_on AND ended_on >= started_on)
  ),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- スキル。経験年数は実績の期間から求める
CREATE TABLE skill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 大文字と小文字の違いだけの重複を拒む（TypeScript と typescript）
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  -- 実績から求めた経験年数を上書きする値。NULL なら上書きしない
  years_override INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 実績で使ったスキル
CREATE TABLE project_skill (
  project_id INTEGER NOT NULL REFERENCES project (id),
  skill_id INTEGER NOT NULL REFERENCES skill (id),
  PRIMARY KEY (project_id, skill_id)
) STRICT;

CREATE INDEX project_skill_skill_id ON project_skill (skill_id);

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

CREATE TRIGGER education_updated_at
AFTER UPDATE ON education
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE education SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER skill_updated_at
AFTER UPDATE ON skill
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE skill SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
