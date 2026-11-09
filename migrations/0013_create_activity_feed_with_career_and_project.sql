-- 一覧のビュー activity_feed を作る。腕は職歴と実績の 2 つ。書き方の決まりは 0003 の冒頭にある。
--
-- 一覧は元の表を UNION ALL のビューでつないで読み、公開側はこのビューだけを読む。サイトに
-- 載せる行だけを出す決まりと、秘匿化の決まりはビューの中に書く（ADR-0046）。列と腕は
-- specs/005-feed/data-model.md の「一覧のビュー」の M1 のとおり。note・外部の activity・
-- life event の腕は、ビューを作り直す migration で足す。SQLite のビューは ALTER VIEW を
-- 持たないため、消して作り直す
--
-- 秘匿化した職歴・実績（is_masked = 1）は、題に project.title_masked、組織名に
-- organization.name_masked を出す。実際の題・実際の組織名・description・url・
-- card_media_id は列に持たない（005 の FR-012・FR-013）。秘匿化した組織名を持たない
-- 組織を指す秘匿化した行は出さない。実績のページの VISITOR_VISIBLE
-- （src/features/project/server/d1-project-repository.ts）と同じ条件
-- （001 の research.md の R5）
--
-- 腕ごとに同じ位置の列の型を揃える。使わない列には CAST で型を付けた NULL を置き、型を
-- 持たない CASE の式にも CAST で型を付ける。腕の式の
-- affinity が揃わないと、ビューの外の条件が腕の中へ下りず全行を読むため（ADR-0046 の
-- Consequences、005 の research.md の R3）
--
-- 列の意味:
-- - item_type: 種類。career・project。kind と呼ばない（project.kind と
--   activity_source.kind が別の意味で使う）
-- - item_id: 種類ごとの元の行の主キー。並べる SQL の中だけで使う。表ごとに id が重なるため、
--   並べるキーは (sort_key, item_type, item_id)
-- - sort_key: 並びの日付。職歴と実績は started_on（暦の日付）
-- - is_masked: 秘匿化した職歴・実績なら 1
-- - title: 実績の題。秘匿化した実績は title_masked
-- - organization_name: 組織名。秘匿化した行は name_masked
-- - role: 職歴の肩書
-- - project_kind: 実績の種類（project.kind）
-- - started_on・ended_on: 職歴・実績の期間
CREATE VIEW activity_feed AS
SELECT
  'career' AS item_type,
  c.id AS item_id,
  c.started_on AS sort_key,
  c.is_masked AS is_masked,
  CAST(NULL AS TEXT) AS title,
  CAST(CASE WHEN c.is_masked = 1 THEN o.name_masked ELSE o.name END AS TEXT) AS organization_name,
  c.role AS role,
  CAST(NULL AS TEXT) AS project_kind,
  c.started_on AS started_on,
  c.ended_on AS ended_on
FROM career AS c
JOIN organization AS o ON o.id = c.organization_id
WHERE c.status = 'published' AND (c.is_masked = 0 OR o.name_masked IS NOT NULL)
UNION ALL
SELECT
  'project' AS item_type,
  p.id AS item_id,
  p.started_on AS sort_key,
  p.is_masked AS is_masked,
  CAST(CASE WHEN p.is_masked = 1 THEN p.title_masked ELSE p.title END AS TEXT) AS title,
  CAST(CASE WHEN p.is_masked = 1 THEN o.name_masked ELSE o.name END AS TEXT) AS organization_name,
  CAST(NULL AS TEXT) AS role,
  p.kind AS project_kind,
  p.started_on AS started_on,
  p.ended_on AS ended_on
FROM project AS p
JOIN organization AS o ON o.id = p.organization_id
WHERE p.status = 'published' AND (p.is_masked = 0 OR o.name_masked IS NOT NULL);
