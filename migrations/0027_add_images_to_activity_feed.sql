-- 一覧のビュー activity_feed に、代表画像の列 card_storage_key と image_url を足す。書き方の決まりは
-- 0003 の冒頭にある。
--
-- 一覧に、いま持っている代表画像を出す（specs/005-feed/plan.md の U5。2026-11-11 にオーナーが
-- 決めた。https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6785283114）。
-- - card_storage_key: 実績・note・life event の代表画像の置き場のキー（media.storage_key）。
--   その行が持つ media だけを読む（card_media_id の複合の外部キーと同じ条件）。note は
--   card_image = 'media' のときだけ出す（ADR-0053。site はサイト共通の画像で、まだ用意していない）
-- - image_url: 外部の activity の取得元が返した画像の URL（activity.image_url）
-- 秘匿化した実績は、代表画像も本文の画像も出さない（005 の spec の FR-013）ので、card_storage_key を
-- NULL にする。職歴は画像を持たないので、どちらも NULL にする
--
-- SQLite は ALTER VIEW を持たないため、消して作り直す。列は最後に足し、0026 までの列の並びを
-- 変えない。腕と列の意味は 0013・0016・0017・0018・0022・0026 の注釈のとおり
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
