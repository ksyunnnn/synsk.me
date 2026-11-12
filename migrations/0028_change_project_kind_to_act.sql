-- 実績の種類 project.kind と、職務経歴書に写した実績の種類 resume_project.kind を、オーナーが何をしたかの
-- 4 値に変える（ADR-0055）。書き方の決まりは 0003 の冒頭にある。
--
-- develop は開発、host は主催、talk は登壇、other はその他。既にある行は application を develop に、
-- event を host に移す。talk と other はそのまま
--
-- SQLite は ALTER TABLE で CHECK を変えられないため、表を作り直す。作り直し方は 0011 と同じで、
-- 行・uid・sqlite_sequence を保ち、指している表（media・project_skill・resume_project_skill）は
-- 作り直さず、外部キーの検査をトランザクションの終わりに送る。列の並びは 0011 と同じにする。
-- ビュー activity_feed は project を読むので、表を消す前に消し、0027 と同じものを作り直す。
-- 索引とトリガは DROP TABLE で消えるため、0011 と同じものを作り直す
PRAGMA defer_foreign_keys = on;

DROP VIEW activity_feed;

CREATE TABLE sequence_copy AS SELECT name, seq FROM sqlite_sequence
WHERE name IN ('project', 'resume_project');

CREATE TABLE project_copy AS SELECT * FROM project;
CREATE TABLE resume_project_copy AS SELECT * FROM resume_project;

DROP TABLE resume_project;
DROP TABLE project;

-- 列と CHECK の意味は 0011 の注釈のとおり。変えたのは kind の CHECK
CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  -- オーナーがその実績で何をしたか。develop は開発、host は主催、talk は登壇、other はその他
  -- （ADR-0055）。値を足すときは、表を作り直す migration を書く
  kind TEXT NOT NULL CHECK (kind IN ('develop', 'host', 'talk', 'other')),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL,
  title_masked TEXT NOT NULL,
  is_masked INTEGER NOT NULL DEFAULT 1 CHECK (is_masked IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  card_media_id INTEGER,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  description TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  FOREIGN KEY (id, card_media_id) REFERENCES media (project_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- 列と CHECK の意味は 0011 の注釈のとおり。変えたのは kind の CHECK
CREATE TABLE resume_project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  resume_id INTEGER NOT NULL REFERENCES resume (id),
  project_id INTEGER REFERENCES project (id),
  organization_name TEXT NOT NULL,
  -- 値の意味は project.kind と同じ
  kind TEXT NOT NULL CHECK (kind IN ('develop', 'host', 'talk', 'other')),
  title TEXT NOT NULL,
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  description TEXT,
  url TEXT,
  is_masked INTEGER NOT NULL DEFAULT 1 CHECK (is_masked IN (0, 1))
) STRICT;

INSERT INTO project (
  id, uid, organization_id, kind, slug, title, title_masked, is_masked, status, card_media_id,
  started_on, ended_on, description, url, created_at, updated_at
)
SELECT
  id, uid, organization_id,
  CASE kind WHEN 'application' THEN 'develop' WHEN 'event' THEN 'host' ELSE kind END,
  slug, title, title_masked, is_masked, status, card_media_id,
  started_on, ended_on, description, url, created_at, updated_at
FROM project_copy;

INSERT INTO resume_project (
  id, uid, resume_id, project_id, organization_name, kind, title, started_on, ended_on,
  description, url, is_masked
)
SELECT
  id, uid, resume_id, project_id, organization_name,
  CASE kind WHEN 'application' THEN 'develop' WHEN 'event' THEN 'host' ELSE kind END,
  title, started_on, ended_on, description, url, is_masked
FROM resume_project_copy;

DELETE FROM sqlite_sequence WHERE name IN ('project', 'resume_project');

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE project_copy;
DROP TABLE resume_project_copy;

-- 0011 と同じ索引
CREATE INDEX project_organization_id ON project (organization_id);

CREATE INDEX resume_project_resume_id ON resume_project (resume_id);

CREATE INDEX resume_project_project_id ON resume_project (project_id);

-- 0011 と同じトリガ
CREATE TRIGGER project_updated_at
AFTER UPDATE ON project
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE project SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER project_uid_fixed
BEFORE UPDATE OF uid ON project
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'project_uid_fixed');
END;

CREATE TRIGGER resume_project_uid_fixed
BEFORE UPDATE OF uid ON resume_project
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'resume_project_uid_fixed');
END;

-- 0027 と同じビュー。列と腕の意味は 0013・0016・0017・0018・0022・0026・0027 の注釈のとおり
CREATE VIEW activity_feed AS
SELECT
  'career' AS item_type,
  c.id AS item_number,
  c.started_on AS sort_at,
  c.is_masked AS is_masked,
  CAST(NULL AS TEXT) AS title,
  CAST(NULL AS TEXT) AS title_masked,
  CAST(CASE WHEN c.is_masked = 0 THEN o.name END AS TEXT) AS organization_name,
  CAST(CASE WHEN c.is_masked = 1 THEN o.name_masked END AS TEXT) AS organization_name_masked,
  c.role AS role,
  CAST(NULL AS TEXT) AS project_kind,
  c.started_on AS started_on,
  c.ended_on AS ended_on,
  CAST(NULL AS TEXT) AS description,
  CAST(NULL AS TEXT) AS source,
  CAST(NULL AS TEXT) AS source_kind,
  CAST(NULL AS TEXT) AS url,
  CAST(NULL AS TEXT) AS created_at,
  CAST(NULL AS TEXT) AS published_at,
  CAST(NULL AS TEXT) AS slug,
  CAST(NULL AS TEXT) AS card_storage_key,
  CAST(NULL AS TEXT) AS image_url
FROM career AS c
JOIN organization AS o ON o.id = c.organization_id
WHERE c.status = 'published' AND (c.is_masked = 0 OR o.name_masked IS NOT NULL)
UNION ALL
SELECT
  'project' AS item_type,
  p.id AS item_number,
  p.started_on AS sort_at,
  p.is_masked AS is_masked,
  CAST(CASE WHEN p.is_masked = 0 THEN p.title END AS TEXT) AS title,
  CAST(CASE WHEN p.is_masked = 1 THEN p.title_masked END AS TEXT) AS title_masked,
  CAST(CASE WHEN p.is_masked = 0 THEN o.name END AS TEXT) AS organization_name,
  CAST(CASE WHEN p.is_masked = 1 THEN o.name_masked END AS TEXT) AS organization_name_masked,
  CAST(NULL AS TEXT) AS role,
  p.kind AS project_kind,
  p.started_on AS started_on,
  p.ended_on AS ended_on,
  CAST(NULL AS TEXT) AS description,
  CAST(NULL AS TEXT) AS source,
  CAST(NULL AS TEXT) AS source_kind,
  CAST(NULL AS TEXT) AS url,
  CAST(NULL AS TEXT) AS created_at,
  CAST(NULL AS TEXT) AS published_at,
  p.slug AS slug,
  CAST(CASE WHEN p.is_masked = 0 THEN pm.storage_key END AS TEXT) AS card_storage_key,
  CAST(NULL AS TEXT) AS image_url
FROM project AS p
JOIN organization AS o ON o.id = p.organization_id
LEFT JOIN media AS pm ON pm.id = p.card_media_id AND pm.project_id = p.id
WHERE p.status = 'published' AND (p.is_masked = 0 OR o.name_masked IS NOT NULL)
UNION ALL
SELECT
  'note' AS item_type,
  n.id AS item_number,
  CAST(strftime('%Y-%m-%dT%H:%M:%f', n.created_at, '+9 hours') AS TEXT) AS sort_at,
  CAST(0 AS INTEGER) AS is_masked,
  r.title AS title,
  CAST(NULL AS TEXT) AS title_masked,
  CAST(NULL AS TEXT) AS organization_name,
  CAST(NULL AS TEXT) AS organization_name_masked,
  CAST(NULL AS TEXT) AS role,
  CAST(NULL AS TEXT) AS project_kind,
  CAST(NULL AS TEXT) AS started_on,
  CAST(NULL AS TEXT) AS ended_on,
  r.description AS description,
  CAST(NULL AS TEXT) AS source,
  CAST(NULL AS TEXT) AS source_kind,
  CAST(NULL AS TEXT) AS url,
  n.created_at AS created_at,
  CAST(NULL AS TEXT) AS published_at,
  n.slug AS slug,
  CAST(CASE WHEN n.card_image = 'media' THEN nm.storage_key END AS TEXT) AS card_storage_key,
  CAST(NULL AS TEXT) AS image_url
FROM note AS n
JOIN note_revision AS r ON r.id = n.published_revision_id AND r.note_id = n.id
LEFT JOIN media AS nm ON nm.id = n.card_media_id AND nm.note_id = n.id
WHERE n.status = 'published' AND n.deleted_at IS NULL
UNION ALL
SELECT
  'external_activity' AS item_type,
  a.id AS item_number,
  CAST(strftime('%Y-%m-%dT%H:%M:%f', a.published_at, '+9 hours') AS TEXT) AS sort_at,
  CAST(0 AS INTEGER) AS is_masked,
  a.title AS title,
  CAST(NULL AS TEXT) AS title_masked,
  CAST(NULL AS TEXT) AS organization_name,
  CAST(NULL AS TEXT) AS organization_name_masked,
  CAST(NULL AS TEXT) AS role,
  CAST(NULL AS TEXT) AS project_kind,
  CAST(NULL AS TEXT) AS started_on,
  CAST(NULL AS TEXT) AS ended_on,
  CAST(NULL AS TEXT) AS description,
  a.source AS source,
  s.kind AS source_kind,
  a.url AS url,
  CAST(NULL AS TEXT) AS created_at,
  a.published_at AS published_at,
  CAST(NULL AS TEXT) AS slug,
  CAST(NULL AS TEXT) AS card_storage_key,
  a.image_url AS image_url
FROM activity AS a
JOIN activity_source AS s ON s.source = a.source
WHERE a.source <> 'life_event'
  AND NOT EXISTS (
    SELECT 1
    FROM syndication AS y
    JOIN note AS sn ON sn.id = y.note_id
    WHERE y.url = a.url AND sn.status = 'published' AND sn.deleted_at IS NULL
  )
UNION ALL
SELECT
  'life_event' AS item_type,
  l.id AS item_number,
  l.sort_at AS sort_at,
  CAST(0 AS INTEGER) AS is_masked,
  l.title AS title,
  CAST(NULL AS TEXT) AS title_masked,
  CAST(NULL AS TEXT) AS organization_name,
  CAST(NULL AS TEXT) AS organization_name_masked,
  CAST(NULL AS TEXT) AS role,
  CAST(NULL AS TEXT) AS project_kind,
  CAST(NULL AS TEXT) AS started_on,
  CAST(NULL AS TEXT) AS ended_on,
  l.description AS description,
  l.source AS source,
  ls.kind AS source_kind,
  CAST(NULL AS TEXT) AS url,
  CAST(NULL AS TEXT) AS created_at,
  CAST(NULL AS TEXT) AS published_at,
  l.slug AS slug,
  CAST(lm.storage_key AS TEXT) AS card_storage_key,
  CAST(NULL AS TEXT) AS image_url
FROM activity AS l
JOIN activity_source AS ls ON ls.source = l.source
LEFT JOIN media AS lm ON lm.id = l.card_media_id AND lm.activity_id = l.id
WHERE l.source = 'life_event';
