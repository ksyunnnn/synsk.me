-- 一覧のビュー activity_feed を作り直し、転載先と一致する外部の activity を除く。書き方の
-- 決まりは 0003 の冒頭にある。
--
-- specs/005-feed/data-model.md の「一覧のビュー」の M4 のとおり。SQLite のビューは ALTER VIEW を
-- 持たないため、消して作り直す。列と、外部の activity の腕のほかの腕は 0017 と同じ
--
-- note を外部のサービスへ転載すると（POSSE）、取得元から取った外部の activity と、同じ内容の
-- note が一覧に 2 行並ぶ。転載先の URL（syndication.url）と URL が一致する外部の activity を、
-- その note が公開中で削除していないときだけ除く（ADR-0006、005 の data-model.md）。note を
-- 下書きに戻すか削除すると、note の腕から消えるので、外部の activity を出し直す
--
-- URL は文字列のまま比べる。syndication.url の UNIQUE の索引で引くので、外部の activity の
-- 1 行ごとに syndication を読み通さない
DROP VIEW activity_feed;

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
  a.description AS description,
  a.source AS source,
  s.kind AS source_kind,
  CAST(NULL AS TEXT) AS url
FROM activity AS a
JOIN activity_source AS s ON s.source = a.source
WHERE a.source = 'life_event';
