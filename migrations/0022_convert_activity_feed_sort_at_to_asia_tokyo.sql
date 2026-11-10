-- 一覧のビュー activity_feed を作り直し、note と外部の activity の並びの値 sort_at を Asia/Tokyo の
-- 時刻にする。書き方の決まりは 0003 の冒頭にある。
--
-- 一覧は Asia/Tokyo の日付で並べる（specs/005-feed/plan.md の U3。2026-11-10 にオーナーが決めた。
-- https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6761595417 ）。日時の列は UTC の
-- 時点（YYYY-MM-DDTHH:MM:SS.sssZ）を持ち、文字列のまま暦の日付と比べると日の境目が UTC の 0 時に
-- なる。日時に 9 時間を足し、末尾の Z を外した Asia/Tokyo の時刻（YYYY-MM-DDTHH:MM:SS.sss）で
-- 並べる。SQLite の時刻関数は時刻帯の名前を持たず、時差を数で書く
-- （https://www.sqlite.org/lang_datefunc.html ）。日本は夏時間を持たないので、時差は 9 時間で
-- 変わらない
--
-- 暦の日付（職歴・実績の started_on、life event の happened_on）は換算しない。0004 の sort_at の
-- 注釈のとおり、暦の日付は文字列の比べ方で同じ日の日時より小さく、新しい順の一覧では同じ日の
-- 日時より古い位置に並ぶ。外部の activity の行は happened_on を持たず（0004 の CHECK）、
-- published_at は日時の形に限る（0020 の CHECK）ので、外部の activity の sort_at は常に
-- published_at の日時で、そのまま換算する
--
-- 換算した sort_at は時点ではない。並べる SQL の中だけで使う。note の作成日と外部の activity の
-- 公開日は、元の UTC の値を created_at・published_at の列で出す（005 の data-model.md の M5）。
-- 列は最後に足し、ほかの腕では型を揃えた NULL を置く。換算した sort_at も CAST で TEXT に揃える。
-- 式のままだと腕の列の affinity が揃わず、ビューの外の条件が腕の中へ下りない（005 の research.md
-- の R3）
--
-- SQLite のビューは ALTER VIEW を持たないため、消して作り直す。腕の条件と、ほかの列は 0018 と
-- 同じ
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
