-- 管理画面の URL に出す識別子 uid を activity に足す。書き方の決まりは 0003 の冒頭にある。
-- 形と入れ方は 0011 と同じ（specs/004-external-activity/research.md の R1）。
--
-- life event の slug はオーナーが書き換えられるため、管理画面の URL には使わない（ADR-0051）。
-- URL を指名した・手で入力した外部の activity も、管理画面で 1 行ずつ開く。
--
-- NOT NULL と UNIQUE は ALTER TABLE ADD COLUMN で足せず、ADD COLUMN の DEFAULT は式を
-- 取れないため、表を作り直す。行はそのまま移す。作り直し方は 0011 と同じ。行を別の表に
-- 写してから消し、同じ名前で作り直した表に行を入れ直す。指している表（media）は作り直さず、
-- 外部キーの検査をトランザクションの終わりに送る。
--
-- DROP TABLE は sqlite_sequence の行も消す。消す前の値を写しておき、入れ直した後に戻す
PRAGMA defer_foreign_keys = on;

CREATE TABLE sequence_copy AS
SELECT name, seq FROM sqlite_sequence WHERE name = 'activity';

CREATE TABLE activity_copy AS
SELECT
  id, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, slug, created_at, updated_at
FROM activity;

DROP TABLE activity;

-- 外部の取得元から取った項目と、life event（人生の出来事の 1 件）。列の意味は 0004 と 0009
CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 管理画面の URL に出す識別子。形と入れ方は 0011 の冒頭のとおり
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 出どころ。life event かどうかもこの列で分かる
  source TEXT NOT NULL REFERENCES activity_source (source),
  -- 取得元での項目の ID。取得元が ID を返さないときは NULL にし、url で判定する
  external_id TEXT,
  -- 取得元の URL。一覧から直接リンクする。取得元で消えたかは、この URL を取り直したときの
  -- 応答で判定する
  url TEXT,
  -- 題
  title TEXT,
  -- life event の説明
  description TEXT,
  -- 代表の画像の URL
  image_url TEXT,
  -- 公開日時。取得元が返した値か、オーナーが登録した値。公開日を返さない取得元から
  -- 取り直すときは上書きしない
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- life event の起きた日（暦の日付）
  happened_on TEXT CHECK (
    happened_on IS NULL
    OR strftime('%Y-%m-%d', happened_on) IS happened_on
  ),
  -- 一覧の並びの値。published_at（日時）か happened_on（暦の日付）を文字列のまま使う。
  -- 暦の日付は、同じ日の日時より前に並ぶ
  sort_at TEXT GENERATED ALWAYS AS (coalesce(published_at, happened_on)) VIRTUAL NOT NULL,
  -- life event の代表画像。この activity が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  -- life event の個別のページの URL に出す識別子（0009）。外部から取り込んだ行は NULL
  slug TEXT CHECK (
    (source = 'life_event') = (slug IS NOT NULL)
    AND (
      slug IS NULL
      OR (length(slug) BETWEEN 1 AND 100 AND slug NOT GLOB '*[^a-z0-9-]*')
    )
  ),
  -- 外部の行では、初めて取り込んだ日時を兼ねる
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- life event だけが起きた日と画像を持つ。ほかの行は URL を持つ
  CHECK ((source = 'life_event') = (happened_on IS NOT NULL)),
  CHECK (source = 'life_event' OR url IS NOT NULL),
  CHECK (source = 'life_event' OR card_media_id IS NULL),
  -- 取得し直したときに同じ項目を 2 行にしない
  UNIQUE (source, external_id),
  -- media.activity_id もこの表を指すため、検査をトランザクションの終わりに送る
  FOREIGN KEY (id, card_media_id) REFERENCES media (activity_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- uid は列に挙げず、DEFAULT が入れる
INSERT INTO activity (
  id, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, slug, created_at, updated_at
)
SELECT
  id, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, slug, created_at, updated_at
FROM activity_copy;

DELETE FROM sqlite_sequence WHERE name = 'activity';

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE activity_copy;

-- 索引とトリガは DROP TABLE で消えるため、0004・0009 と同じものを作り直す
CREATE UNIQUE INDEX activity_source_url ON activity (source, url) WHERE external_id IS NULL;

CREATE INDEX activity_sort_at ON activity (sort_at, id);

CREATE UNIQUE INDEX activity_slug ON activity (slug) WHERE slug IS NOT NULL;

CREATE TRIGGER activity_updated_at
AFTER UPDATE ON activity
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE activity SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- uid を書き換えると、開いている管理画面の URL が別の行を指すか、どの行も指さなくなる
CREATE TRIGGER activity_uid_fixed
BEFORE UPDATE OF uid ON activity
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'activity_uid_fixed');
END;
