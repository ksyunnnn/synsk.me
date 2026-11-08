-- 訪問者の一覧（specs/005-feed/data-model.md、ADR-0044）。
--
-- 外部の activity・life event・note・実績・職歴を UNION ALL でつなぐ。訪問者の一覧は
-- このビューだけを読む。公開の note だけを出す決まり、サイトに載せる実績と職歴だけを
-- 出す決まり、秘匿化した実績と職歴を秘匿化した値で出す決まり、転載先と一致する外部の
-- activity を除く決まりは、このビューが持つ。
--
-- 列は訪問者に出してよい値だけにする。秘匿化するかで中身が変わる列は visible_ で始める
-- （specs/005-feed/research.md の R3）。本文・関連 URL・画像・uid・学歴は持たない。
--
-- sort_key は並びの日付。日時は日本時間に直して末尾の Z を外し、暦の日付はそのまま置く。
-- 暦の日付は同じ日の日時より文字列で小さいので、新しい順で後に並ぶ（research.md の R4）。
-- 並べる順はビューに書かず、読む側の ORDER BY が持つ。
CREATE VIEW activity_feed AS
SELECT
  'note' AS item_type,
  n.id AS item_id,
  1 AS type_rank,
  strftime('%Y-%m-%dT%H:%M:%f', n.created_at, '+9 hours') AS sort_key,
  n.slug AS slug,
  NULL AS url,
  r.title AS visible_title,
  r.description AS description,
  NULL AS source,
  NULL AS source_kind,
  NULL AS visible_organization_name,
  NULL AS role,
  NULL AS project_kind,
  NULL AS started_on,
  NULL AS ended_on,
  0 AS is_masked,
  NULL AS skills
FROM note AS n
JOIN note_revision AS r ON r.id = n.published_revision_id AND r.note_id = n.id
WHERE n.status = 'published' AND n.deleted_at IS NULL

UNION ALL

SELECT
  'external_activity',
  a.id,
  2,
  strftime('%Y-%m-%dT%H:%M:%f', a.published_at, '+9 hours'),
  NULL,
  a.url,
  a.title,
  NULL,
  a.source,
  s.kind,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  NULL
FROM activity AS a
JOIN activity_source AS s ON s.source = a.source
WHERE a.source <> 'life_event'
  -- 公開で削除していない note の転載先と同じ URL の記事は、note と重ねない（ADR-0006）
  AND NOT EXISTS (
    SELECT 1
    FROM syndication AS y
    JOIN note AS sn ON sn.id = y.note_id
    WHERE y.url = a.url AND sn.status = 'published' AND sn.deleted_at IS NULL
  )

UNION ALL

SELECT
  'life_event',
  a.id,
  3,
  a.happened_on,
  a.slug,
  NULL,
  a.title,
  NULL,
  a.source,
  s.kind,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  NULL
FROM activity AS a
JOIN activity_source AS s ON s.source = a.source
WHERE a.source = 'life_event'

UNION ALL

SELECT
  'project',
  p.id,
  4,
  p.started_on,
  p.slug,
  NULL,
  CASE WHEN p.is_masked = 1 THEN p.title_masked ELSE p.title END,
  NULL,
  NULL,
  NULL,
  CASE WHEN p.is_masked = 1 THEN o.name_masked ELSE o.name END,
  NULL,
  p.kind,
  p.started_on,
  p.ended_on,
  p.is_masked,
  (
    SELECT json_group_array(name)
    FROM (
      SELECT k.name
      FROM project_skill AS ps
      JOIN skill AS k ON k.id = ps.skill_id
      WHERE ps.project_id = p.id
      ORDER BY k.name
    )
  )
FROM project AS p
JOIN organization AS o ON o.id = p.organization_id
-- 秘匿化した組織名の無い組織を指す秘匿化した実績は出さない（specs/001-career-and-project/plan.md の U2）
WHERE p.status = 'published' AND (p.is_masked = 0 OR o.name_masked IS NOT NULL)

UNION ALL

SELECT
  'career',
  c.id,
  5,
  c.started_on,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  CASE WHEN c.is_masked = 1 THEN o.name_masked ELSE o.name END,
  c.role,
  NULL,
  c.started_on,
  c.ended_on,
  c.is_masked,
  NULL
FROM career AS c
JOIN organization AS o ON o.id = c.organization_id
WHERE c.status = 'published' AND (c.is_masked = 0 OR o.name_masked IS NOT NULL);
