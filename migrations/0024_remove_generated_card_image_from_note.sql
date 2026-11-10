-- note を作り直し、代表画像の出どころから、題を入れて自動で作る画像（generated）を外す。既定を
-- サイト共通の画像（site）にする。書き方の決まりは 0003 の冒頭にある。
--
-- 003 の spec は、代表画像の出どころを note の画像とサイト共通の画像の 2 つとする（FR-024。
-- 2026-11-10 にオーナーが決めた。https://github.com/ksyunnnn/synsk.me/issues/219 の U8 の報告）。
--
-- 既にある generated の行は site に変える。generated は画像を作らず、OGP に画像を出していなかった。
-- site は、サイト共通の画像を出す。どちらもオーナーが上げた画像を指さないため、card_media_id は
-- NULL のまま変わらない
--
-- SQLite は ALTER TABLE で CHECK と DEFAULT を変えられないため、表を作り直す。作り直し方は
-- 0012・0021 と同じで、行・uid・sqlite_sequence を保ち、指している表（note_revision・media・
-- syndication）は作り直さず、外部キーの検査をトランザクションの終わりに送る。ビュー
-- activity_feed は note を読むので、表を消す前に消し、同じものを作り直す。トリガは DROP TABLE で
-- 消えるため、0005・0012 と同じものを作り直す
PRAGMA defer_foreign_keys = on;

DROP VIEW activity_feed;

CREATE TABLE sequence_copy AS SELECT name, seq FROM sqlite_sequence WHERE name = 'note';

CREATE TABLE note_copy AS SELECT * FROM note;

DROP TABLE note;

-- 列と CHECK の意味は 0005・0012・0023 の注釈のとおり。変えたのは card_image の CHECK と DEFAULT。
-- 列の並びは 0023 までと同じにする
CREATE TABLE note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 管理画面の URL に出す識別子。形と入れ方は 0012 の冒頭のとおり
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 訪問者向けの URL に出す識別子。削除した note を含めて重ならない
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  -- draft は下書き、published は訪問者に見せる。作ったときは下書き
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 最後に公開した版。下書きに戻した note でも残す
  published_revision_id INTEGER,
  -- 初めて公開した日時。一度入れたら変えない（下のトリガ）
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- 削除した日時。NULL でなければ削除した note である。戻すと NULL に戻る
  deleted_at TEXT CHECK (
    deleted_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS deleted_at
  ),
  -- 代表画像の出どころ。media は note に上げた画像、site はサイト共通の画像（docs/CRAWLING.md）。
  -- 作ったときは site
  card_image TEXT NOT NULL DEFAULT 'site' CHECK (card_image IN ('media', 'site')),
  -- 上げた代表画像。この note が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- 説明文が空のときに本文の最初の段落を説明に使うか。1 は使い、0 は何も出さない（0023）
  is_first_paragraph_as_description INTEGER NOT NULL DEFAULT 1 CHECK (
    is_first_paragraph_as_description IN (0, 1)
  ),
  -- 公開したことのある note だけが、公開した版と初めて公開した日時を持つ
  CHECK ((published_revision_id IS NULL) = (published_at IS NULL)),
  -- 公開の note は、訪問者に見せる版を持つ
  CHECK (status = 'draft' OR published_revision_id IS NOT NULL),
  -- 上げた画像を使うときだけ、その画像を指す
  CHECK ((card_image = 'media') = (card_media_id IS NOT NULL)),
  FOREIGN KEY (id, published_revision_id) REFERENCES note_revision (note_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (id, card_media_id) REFERENCES media (note_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- uid も写す。管理画面の URL が指す行を変えない。generated は site に変える（冒頭の注釈）
INSERT INTO note (
  id, uid, slug, status, published_revision_id, published_at, deleted_at, card_image,
  card_media_id, created_at, updated_at, is_first_paragraph_as_description
)
SELECT
  id, uid, slug, status, published_revision_id, published_at, deleted_at,
  CASE card_image WHEN 'generated' THEN 'site' ELSE card_image END,
  card_media_id, created_at, updated_at, is_first_paragraph_as_description
FROM note_copy;

DELETE FROM sqlite_sequence WHERE name = 'note';

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE note_copy;

-- 0005 と同じトリガ。0023 は作り直していない
CREATE TRIGGER note_slug_fixed_after_publication
BEFORE UPDATE OF slug ON note
FOR EACH ROW
WHEN NEW.slug <> OLD.slug AND OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'note_slug_fixed_after_publication');
END;

CREATE TRIGGER note_published_at_fixed
BEFORE UPDATE OF published_at ON note
FOR EACH ROW
WHEN OLD.published_at IS NOT NULL AND NEW.published_at IS NOT OLD.published_at
BEGIN
  SELECT RAISE(ABORT, 'note_published_at_fixed');
END;

CREATE TRIGGER note_published_revision_valid
BEFORE UPDATE OF published_revision_id ON note
FOR EACH ROW
WHEN NEW.published_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM note_revision
    WHERE id = NEW.published_revision_id AND note_id = NEW.id AND title <> ''
  )
BEGIN
  SELECT RAISE(ABORT, 'note_published_revision_invalid');
END;

CREATE TRIGGER note_updated_at
AFTER UPDATE ON note
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE note SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- 0012 と同じトリガ
CREATE TRIGGER note_uid_fixed
BEFORE UPDATE OF uid ON note
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'note_uid_fixed');
END;

-- 0022 と同じビュー。列と腕の意味は 0013・0016・0017・0018・0022 の注釈のとおり
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
  CAST(NULL AS TEXT) AS published_at
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
  CAST(NULL AS TEXT) AS published_at
FROM project AS p
JOIN organization AS o ON o.id = p.organization_id
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
  CAST(NULL AS TEXT) AS published_at
FROM note AS n
JOIN note_revision AS r ON r.id = n.published_revision_id AND r.note_id = n.id
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
  a.published_at AS published_at
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
  CAST(NULL AS TEXT) AS published_at
FROM activity AS l
JOIN activity_source AS ls ON ls.source = l.source
WHERE l.source = 'life_event';
