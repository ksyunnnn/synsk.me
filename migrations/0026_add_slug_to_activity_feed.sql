-- 一覧のビュー activity_feed に、個別のページの識別子の列 slug を足す。書き方の決まりは 0003 の
-- 冒頭にある。
--
-- 一覧の行から個別のページへリンクする（specs/005-feed/plan.md の U4。2026-11-11 にオーナーが
-- 決めた。https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6784129166）。個別のページを
-- 持つのは実績・note・life event で、それぞれ project.slug・note.slug・activity.slug を出す。
-- 秘匿化した実績も個別のページを持つので出す（001 の spec の Edge Cases）。秘匿化した実績の識別子は
-- uid で、実際の題や組織名を含まない（001 の spec の FR-013）。職歴と外部の activity は個別のページを
-- 持たないので NULL にする。主キー（item_number）は URL に出さない（ADR-0048）
--
-- SQLite は ALTER VIEW を持たないため、消して作り直す。列は最後に足し、0024 までの列の並びを
-- 変えない。腕と列の意味は 0013・0016・0017・0018・0022 の注釈のとおり
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
  CAST(NULL AS TEXT) AS url,
  CAST(NULL AS TEXT) AS created_at,
  CAST(NULL AS TEXT) AS published_at,
  CAST(NULL AS TEXT) AS slug
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
  p.slug AS slug
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
  CAST(NULL AS TEXT) AS published_at,
  n.slug AS slug
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
  a.published_at AS published_at,
  CAST(NULL AS TEXT) AS slug
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
  l.slug AS slug
FROM activity AS l
JOIN activity_source AS ls ON ls.source = l.source
WHERE l.source = 'life_event';
