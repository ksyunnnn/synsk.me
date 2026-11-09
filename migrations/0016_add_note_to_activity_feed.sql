-- 一覧のビュー activity_feed を作り直し、note の腕と description の列を足す。書き方の決まりは
-- 0003 の冒頭にある。
--
-- 列と腕は specs/005-feed/data-model.md の「一覧のビュー」の M2 のとおり。SQLite のビューは
-- ALTER VIEW を持たないため、消して作り直す。職歴と実績の腕と、0013 の列の意味・型の揃え方は
-- 0013 の注釈のとおりで、変えない。足す列はビューの最後に置き、0013 の列の並びを変えない
--
-- note の腕:
-- - 公開中で削除していない note だけを出す（note.status = 'published' AND
--   note.deleted_at IS NULL）。題と説明文は、公開した版（note.published_revision_id）のもの。
--   下書きの版の題と説明文は出さない
-- - sort_at は note.created_at（005 の data-model.md）
-- - 秘匿化しないので is_masked は 0
--
-- 足す列:
-- - description: note の公開した版の説明文。職歴と実績の腕では NULL。秘匿化した行は説明を
--   持たず（005 の FR-012・FR-013）、秘匿化しない行の本文は見せ方が決まるまで一覧に出さない
--   （005 の research.md の R6）
--
-- 型の揃え方: 型を持たない数の literal（note の is_masked の 0）にも CAST で型を付ける。
-- 職歴と実績の腕の is_masked は INTEGER の列なので、揃えないとビューの外の条件が腕の中へ
-- 下りない（005 の research.md の R3）
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
  CAST(NULL AS TEXT) AS description
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
  CAST(NULL AS TEXT) AS description
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
  r.description AS description
FROM note AS n
JOIN note_revision AS r ON r.id = n.published_revision_id AND r.note_id = n.id
WHERE n.status = 'published' AND n.deleted_at IS NULL;
