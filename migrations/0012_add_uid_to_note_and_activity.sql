-- note・note_revision・activity に、管理画面の URL に出す識別子 uid を足す。004 の取得元の
-- 行を activity_source に入れる。書き方の決まりは 0003 の冒頭にある。
--
-- uid の形・入れ方・書き換えの拒み方は 0011 と同じ（ADR-0051）。管理画面の URL は
-- /dash/notes/{uid}・/dash/notes/{uid}/revisions/{revisionUid}・/dash/life-events/{uid}・
-- /dash/activities/{uid} になる。主キーは URL に出さない（ADR-0048）。note.slug と
-- activity.slug は書き換わるため、管理画面の URL には使わない。
--
-- NOT NULL と UNIQUE は ALTER TABLE ADD COLUMN で足せず、ADD COLUMN の DEFAULT は式を
-- 取れないため、表を作り直す。行はそのまま移し、uid は DEFAULT が入れる。作り直し方は
-- 0011 と同じ。指している表（media・syndication）は作り直さず、外部キーの検査を
-- トランザクションの終わりに送る。DROP TABLE は sqlite_sequence の行も消すため、消す前の
-- 値を写しておき、入れ直した後に戻す。索引とトリガは DROP TABLE で消えるため、0005・
-- 0004・0009 と同じものを作り直す
PRAGMA defer_foreign_keys = on;

CREATE TABLE sequence_copy AS
SELECT name, seq FROM sqlite_sequence WHERE name IN ('note', 'note_revision', 'activity');

CREATE TABLE note_copy AS SELECT * FROM note;
CREATE TABLE note_revision_copy AS SELECT * FROM note_revision;
CREATE TABLE activity_copy AS SELECT * FROM activity;

DROP TABLE note_revision;
DROP TABLE note;
DROP TABLE activity;

-- 列と CHECK の意味は 0005 の注釈のとおり。spec は specs/003-note/spec.md
CREATE TABLE note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 管理画面の URL に出す識別子。形と入れ方は冒頭のとおり。下の表の uid も同じ
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 訪問者向けの URL に出す識別子。削除した note を含めて重ならない
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  -- draft は下書き、published は訪問者に見せる。作ったときは下書き
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 最後に公開した版。下書きに戻した note でも残す
  published_revision_id INTEGER,
  -- 初めて公開した日時。一度入れたら変えない（下のトリガ）
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- 削除した日時。NULL でなければ削除した note である。戻すと NULL に戻る
  deleted_at TEXT CHECK (
    deleted_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS deleted_at
  ),
  -- 代表画像の出どころ。generated は題を入れて自動で作る画像、media は note に
  -- 上げた画像、site はサイト共通の画像（docs/CRAWLING.md）
  card_image TEXT NOT NULL DEFAULT 'generated' CHECK (
    card_image IN ('generated', 'media', 'site')
  ),
  -- 上げた代表画像。この note が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- 公開したことのある note だけが、公開した版と初めて公開した日時を持つ
  CHECK ((published_revision_id IS NULL) = (published_at IS NULL)),
  -- 公開の note は、訪問者に見せる版を持つ
  CHECK (status = 'draft' OR published_revision_id IS NOT NULL),
  -- 上げた画像を使うときだけ、その画像を指す
  CHECK ((card_image = 'media') = (card_media_id IS NOT NULL)),
  FOREIGN KEY (id, published_revision_id) REFERENCES note_revision (note_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (id, card_media_id) REFERENCES media (note_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- note の版。保存のたびに 1 つ足し、書き換えない（下のトリガ）。
-- 作り手が書き換えている内容は、note ごとの id が最大の版
CREATE TABLE note_revision (
  -- 大きいほど新しい版
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 版が属する note。note を完全に消すときは、同じトランザクションで版を先に消す
  note_id INTEGER NOT NULL REFERENCES note (id),
  -- 題。下書きのうちは空でよい。空の題の版は公開できない（下のトリガ）
  title TEXT NOT NULL CHECK (length(title) <= 200),
  -- 説明の文。題・本文と同じく、公開し直すまで訪問者に見えない
  description TEXT,
  -- 本文。書式は Markdown
  body TEXT NOT NULL CHECK (length(body) <= 100000),
  -- 版を作った日時
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  )
) STRICT;

-- note の外部キー（note_id, published_revision_id）が指す先。行を入れ直す前に張る。指す先に
-- UNIQUE の索引が無いと、外部キーを確かめられず INSERT が止まる
CREATE UNIQUE INDEX note_revision_note_id ON note_revision (note_id, id);

-- 外部の取得元から取った項目と、life event。列と CHECK の意味は 0004 と 0009 の注釈のとおり。
-- spec は specs/004-external-activity/spec.md
CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- 出どころ。life event かどうかもこの列で分かる
  source TEXT NOT NULL REFERENCES activity_source (source),
  -- 取得元での項目の ID。取得元が ID を返さないときは NULL にし、url で判定する
  external_id TEXT,
  -- 取得元の URL
  url TEXT,
  -- 題
  title TEXT,
  -- life event の説明
  description TEXT,
  -- 代表の画像の URL
  image_url TEXT,
  -- 公開日時。取得元が返した値か、オーナーが登録した値
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- life event の起きた日（暦の日付）
  happened_on TEXT CHECK (
    happened_on IS NULL
    OR strftime('%Y-%m-%d', happened_on) IS happened_on
  ),
  -- 一覧の並びの値。published_at（日時）か happened_on（暦の日付）を文字列のまま使う
  sort_at TEXT GENERATED ALWAYS AS (coalesce(published_at, happened_on)) VIRTUAL NOT NULL,
  -- life event の代表画像。この activity が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  -- 外部の行では、初めて取り込んだ日時を兼ねる
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- life event の個別のページの URL に出す識別子。life event だけが持つ
  slug TEXT CHECK (
    (source = 'life_event') = (slug IS NOT NULL)
    AND (
      slug IS NULL
      OR (length(slug) BETWEEN 1 AND 100 AND slug NOT GLOB '*[^a-z0-9-]*')
    )
  ),
  -- life event だけが起きた日と画像を持つ。ほかの行は URL を持つ
  CHECK ((source = 'life_event') = (happened_on IS NOT NULL)),
  CHECK (source = 'life_event' OR url IS NOT NULL),
  CHECK (source = 'life_event' OR card_media_id IS NULL),
  -- 取得し直したときに同じ項目を 2 行にしない
  UNIQUE (source, external_id),
  FOREIGN KEY (id, card_media_id) REFERENCES media (activity_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- 親の表から入れ直す。uid は列に挙げず、DEFAULT が入れる
INSERT INTO note (
  id, slug, status, published_revision_id, published_at, deleted_at, card_image, card_media_id,
  created_at, updated_at
)
SELECT
  id, slug, status, published_revision_id, published_at, deleted_at, card_image, card_media_id,
  created_at, updated_at
FROM note_copy;

INSERT INTO note_revision (id, note_id, title, description, body, created_at)
SELECT id, note_id, title, description, body, created_at FROM note_revision_copy;

INSERT INTO activity (
  id, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, created_at, updated_at, slug
)
SELECT
  id, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, created_at, updated_at, slug
FROM activity_copy;

DELETE FROM sqlite_sequence WHERE name IN ('note', 'note_revision', 'activity');

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE note_copy;
DROP TABLE note_revision_copy;
DROP TABLE activity_copy;

-- 0005 と同じトリガ
CREATE TRIGGER note_revision_immutable
BEFORE UPDATE ON note_revision
BEGIN
  SELECT RAISE(ABORT, 'note_revision_immutable');
END;

CREATE TRIGGER note_slug_fixed_after_publication
BEFORE UPDATE OF slug ON note
FOR EACH ROW
WHEN NEW.slug <> OLD.slug AND OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'note_slug_fixed_after_publication');
END;

CREATE TRIGGER note_published_at_fixed
BEFORE UPDATE OF published_at ON note
FOR EACH ROW
WHEN OLD.published_at IS NOT NULL AND NEW.published_at IS NOT OLD.published_at
BEGIN
  SELECT RAISE(ABORT, 'note_published_at_fixed');
END;

CREATE TRIGGER note_published_revision_valid
BEFORE UPDATE OF published_revision_id ON note
FOR EACH ROW
WHEN NEW.published_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM note_revision
    WHERE id = NEW.published_revision_id AND note_id = NEW.id AND title <> ''
  )
BEGIN
  SELECT RAISE(ABORT, 'note_published_revision_invalid');
END;

CREATE TRIGGER note_updated_at
AFTER UPDATE ON note
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE note SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- 0004 と 0009 と同じ索引とトリガ
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

-- uid を書き換えると、開いている管理画面の URL が別の行を指すか、どの行も指さなくなる。
-- note_revision の uid は、どの列の書き換えも拒む note_revision_immutable が守る
CREATE TRIGGER note_uid_fixed
BEFORE UPDATE OF uid ON note
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'note_uid_fixed');
END;

CREATE TRIGGER activity_uid_fixed
BEFORE UPDATE OF uid ON activity
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'activity_uid_fixed');
END;

-- 004 の取得元（specs/004-external-activity/spec.md の Assumptions の分類）。source の値は
-- サービスの名前から空白と記号を除いた英小文字の 1 語にし（例: dev.to は devto）、
-- 004 の取得元ごとのファイル名（specs/004-external-activity/plan.md）と揃える。_ は 0004 の
-- 注釈の、1 つのサービスから複数の種類を取り込むときの区切り（例: zenn_article）に残す。
-- 004 の取得元は、どれも 1 つのサービスから 1 種類だけを取り込む。kind の意味は 0007 の注釈のとおり
INSERT INTO activity_source (source, kind) VALUES
  ('zenn', 'article'),
  ('qiita', 'article'),
  ('devto', 'article'),
  ('medium', 'article'),
  ('speakerdeck', 'embed'),
  ('spotify', 'embed'),
  ('x', 'embed'),
  ('codesandbox', 'embed'),
  ('youtube', 'embed'),
  ('codepen', 'embed'),
  ('github', 'other'),
  ('connpass', 'other');
