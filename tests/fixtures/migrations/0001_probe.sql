-- 配管を確かめるためだけのマイグレーション。本番の migrations/ とは別で、
-- tests/wrangler.test.jsonc だけが参照する。
CREATE TABLE probe (
  id TEXT PRIMARY KEY,
  visible TEXT NOT NULL,
  hidden TEXT NOT NULL
);
