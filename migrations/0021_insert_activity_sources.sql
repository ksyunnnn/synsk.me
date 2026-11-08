-- 外部の取得元の行を入れる。書き方の決まりは 0003 の冒頭にある。
--
-- 0004 の注釈「外部の取得元の行は、取得の処理と一緒に入れる」による。分類は
-- specs/004-external-activity/spec.md の Assumptions（2026-10-28 のオーナーの決定）、
-- 取り込み方は src/features/activity/domain/source.ts が持つ（spec の FR-004）。
-- 分類を変えるときは、この表の kind を書き換える migration を書く（research.md の R14）
INSERT INTO activity_source (source, kind) VALUES
  -- 記事
  ('zenn_article', 'article'),
  ('qiita_article', 'article'),
  ('devto_article', 'article'),
  ('medium_article', 'article'),
  -- 埋め込み
  ('speakerdeck_deck', 'embed'),
  ('x_post', 'embed'),
  ('spotify_playlist', 'embed'),
  ('youtube_video', 'embed'),
  ('codesandbox_sandbox', 'embed'),
  ('codepen_pen', 'embed'),
  -- その他
  ('github_repository', 'other'),
  ('connpass_event', 'other');
