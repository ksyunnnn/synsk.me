-- 一覧のビュー activity_feed を作り直し、外部の activity と life event の腕と、source・
-- source_kind・url の列を足す。書き方の決まりは 0003 の冒頭にある。
--
-- 列と腕は specs/005-feed/data-model.md の「一覧のビュー」の M3 のとおり。SQLite のビューは
-- ALTER VIEW を持たないため、消して作り直す。職歴・実績・note の腕と、0013・0016 の列の意味・
-- 型の揃え方は 0013・0016 の注釈のとおりで、足す列のほかは変えない。足す列はビューの最後に
-- 置き、0016 までの列の並びを変えない
--
-- 外部の activity の腕: life event でない activity のすべて。取得元で消えたと確かめた行は
-- 004 が消すので、消えた行を除く条件を持たない（005 の FR-002、004 の research.md の R6）。
-- 転載先と一致する行の除外は、ビューを作り直す別の migration で足す（005 の data-model.md の
-- M4）
-- life event の腕: life event の activity のすべて
--
-- どちらも sort_at は activity.sort_at（published_at か happened_on）。秘匿化しないので
-- is_masked は 0
--
-- life event の腕は、0016 が足した description に life event の説明を出す。外部の activity の
-- 腕では NULL（005 の data-model.md）
--
-- 腕の別名は腕ごとに分ける（外部の activity は a、life event は l）。EXPLAIN QUERY PLAN の
-- 行から、どちらの腕が主キーで引くかを見分けるため
--
-- 腕はこれで 5 つになる。手元の workerd の D1 は、腕が 6 つの compound SELECT を
-- too many terms in compound SELECT で拒んだ（2026-11-09 に tests/workers/feed-repository.test.ts で
-- 実測）。腕を足すときは、まずこの上限を確かめる
--
-- 足す列:
-- - source: 外部の activity と life event の取得元（activity.source）。ほかの腕では NULL
-- - source_kind: 取得元の分類（activity_source.kind）。ほかの腕では NULL。kind と呼ばない
--   理由は 0013 の item_type の注釈のとおり
-- - url: 外部の activity の取得元の URL。life event とほかの腕では NULL
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
