-- activity を作り直し、life event の行が空の題 title を持てないようにする。書き方の決まりは 0003 の
-- 冒頭にある。
--
-- 004 の spec は、life event の題を必ず入れるとする（FR-024。2026-11-10 にオーナーが決めた。
-- https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6765023021 ）。NULL と、空白だけの値を
-- 拒む。空白は JavaScript の String.prototype.trim() が除く文字（ECMAScript の WhiteSpace と
-- LineTerminator。BMP の 25 文字）で、アプリケーションの入力の検査（parseLifeEventContent）と
-- 同じにする。SQLite の trim() は既定で半角の空白だけを除くため、文字を並べて渡す。0020 と同じく、
-- life event の列の決まりを CHECK に置き、アプリケーションの入力の検査を通らない書き込みも拒む
-- （docs/SOFTWARE_DESIGN.md の原則 2）。
-- 外部の activity の題は、取得元が題を返さないことがあるため、空のままにできる
--
-- 既にある life event の行の題が空なら、行を入れ直すところで CHECK が止め、migration は当たらない。
-- 題を黙って埋めない（原則 2）。当てる前に、本番と preview の D1 で次の文が 0 行を返すことを
-- 確かめる。行があれば、その行に題を入れてから当てる
--   SELECT id, uid FROM activity WHERE source = 'life_event'
--     AND (title IS NULL OR trim(title, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194,
--       8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)) = '');
--
-- SQLite は ALTER TABLE で CHECK を足せないため、表を作り直す。作り直し方は 0012・0020 と同じで、
-- 行・uid・sqlite_sequence を保ち、指している表（media）は作り直さず、外部キーの検査を
-- トランザクションの終わりに送る。列の並びは 0020 と同じにする。ビュー activity_feed は
-- activity を読むので、表を消す前に消し、0018 と同じものを作り直す。索引とトリガは DROP TABLE で
-- 消えるため、0004・0009・0012・0015 と同じものを作り直す
PRAGMA defer_foreign_keys = on;

DROP VIEW activity_feed;

CREATE TABLE sequence_copy AS SELECT name, seq FROM sqlite_sequence WHERE name = 'activity';

CREATE TABLE activity_copy AS SELECT * FROM activity;

DROP TABLE activity;

-- 列と CHECK の意味は 0004・0009・0012・0015・0019・0020 の注釈のとおり。足したのは
-- life_event_with_title の CHECK
CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 出どころ。life event かどうかもこの列で分かる
  source TEXT NOT NULL REFERENCES activity_source (source),
  -- 取得元での項目の ID。取得元が ID を返さないときは NULL にし、url で判定する
  external_id TEXT,
  -- 取得元の URL
  url TEXT,
  -- 題。life event の行は空でない（下の CHECK）
  title TEXT,
  -- life event の説明
  description TEXT,
  -- 代表の画像の URL
  image_url TEXT,
  -- 公開日時。取得元が返した値か、オーナーが登録した値。外部の activity だけが持つ（下の CHECK）
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- life event の起きた日（暦の日付）
  happened_on TEXT CHECK (
    happened_on IS NULL
    OR strftime('%Y-%m-%d', happened_on) IS happened_on
  ),
  -- 一覧の並びの値。published_at（日時）か happened_on（暦の日付）を文字列のまま使う
  sort_at TEXT GENERATED ALWAYS AS (coalesce(published_at, happened_on)) VIRTUAL NOT NULL,
  -- life event の代表画像。この activity が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  -- 外部の行では、初めて取り込んだ日時を兼ねる
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- life event の個別のページの URL に出す識別子。life event だけが持つ
  slug TEXT CHECK (
    (source = 'life_event') = (slug IS NOT NULL)
    AND (
      slug IS NULL
      OR (length(slug) BETWEEN 1 AND 100 AND slug NOT GLOB '*[^a-z0-9-]*')
    )
  ),
  -- 取得元で消えたかを最後に確かめた日時。意味は 0015 の注釈のとおり
  gone_checked_at TEXT CHECK (
    gone_checked_at IS NULL
    OR (
      source <> 'life_event'
      AND strftime('%Y-%m-%dT%H:%M:%fZ', gone_checked_at) IS gone_checked_at
    )
  ),
  -- 取り直した URL が続けて 404 を返した回数。意味は 0019 の注釈のとおり
  consecutive_gone_count INTEGER NOT NULL DEFAULT 0 CHECK (
    consecutive_gone_count >= 0
    AND (source <> 'life_event' OR consecutive_gone_count = 0)
  ),
  -- life event だけが起きた日と画像を持つ。ほかの行は URL を持つ
  CHECK ((source = 'life_event') = (happened_on IS NOT NULL)),
  CHECK (source = 'life_event' OR url IS NOT NULL),
  CHECK (source = 'life_event' OR card_media_id IS NULL),
  -- life event は公開日とリンク先を持たず、起きた日で並ぶ。意味は 0020 の注釈のとおり
  CONSTRAINT life_event_without_link_and_published_at CHECK (
    source <> 'life_event'
    OR (published_at IS NULL AND url IS NULL AND external_id IS NULL AND image_url IS NULL)
  ),
  -- life event は空白だけでない題を持つ（004 の spec の FR-024）。空白の文字は冒頭の注釈のとおり。
  -- 名前を付け、拒んだときの文言で、この決まりに当たったと分かるようにする
  CONSTRAINT life_event_with_title CHECK (
    source <> 'life_event'
    OR (
      title IS NOT NULL
      AND trim(
        title,
        char(
          9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,
          8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279
        )
      ) <> ''
    )
  ),
  -- 取得し直したときに同じ項目を 2 行にしない
  UNIQUE (source, external_id),
  FOREIGN KEY (id, card_media_id) REFERENCES media (activity_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- uid も写す。管理画面の URL が指す行を変えない
INSERT INTO activity (
  id, uid, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, created_at, updated_at, slug, gone_checked_at, consecutive_gone_count
)
SELECT
  id, uid, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, created_at, updated_at, slug, gone_checked_at, consecutive_gone_count
FROM activity_copy;

DELETE FROM sqlite_sequence WHERE name = 'activity';

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE activity_copy;

-- 0004・0009 と同じ索引
CREATE UNIQUE INDEX activity_source_url ON activity (source, url) WHERE external_id IS NULL;

CREATE INDEX activity_sort_at ON activity (sort_at, id);

CREATE UNIQUE INDEX activity_slug ON activity (slug) WHERE slug IS NOT NULL;

-- 0015 と同じトリガ。updated_at を進める列を挙げ、gone_checked_at・consecutive_gone_count
-- だけの UPDATE では進めない（0015・0019 の注釈）
CREATE TRIGGER activity_updated_at
AFTER UPDATE OF
  id, uid, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, created_at, slug
ON activity
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE activity SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- 0012 と同じトリガ
CREATE TRIGGER activity_uid_fixed
BEFORE UPDATE OF uid ON activity
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'activity_uid_fixed');
END;

-- 0018 と同じビュー。列と腕の意味は 0013・0016・0017・0018 の注釈のとおり
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
  CAST(NULL AS TEXT) AS url
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
  CAST(NULL AS TEXT) AS url
FROM project AS p
JOIN organization AS o ON o.id = p.organization_id
WHERE p.status = 'published' AND (p.is_masked = 0 OR o.name_masked IS NOT NULL)
UNION ALL
SELECT
  'note' AS item_type,
  n.id AS item_number,
  n.created_at AS sort_at,
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
  CAST(NULL AS TEXT) AS url
FROM note AS n
JOIN note_revision AS r ON r.id = n.published_revision_id AND r.note_id = n.id
WHERE n.status = 'published' AND n.deleted_at IS NULL
UNION ALL
SELECT
  'external_activity' AS item_type,
  a.id AS item_number,
  a.sort_at AS sort_at,
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
  a.url AS url
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
  CAST(NULL AS TEXT) AS url
FROM activity AS l
JOIN activity_source AS ls ON ls.source = l.source
WHERE l.source = 'life_event';
