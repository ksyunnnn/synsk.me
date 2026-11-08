-- 管理画面の URL に出す識別子 uid を note に足す（specs/003-note/research.md の R1）。
-- 書き方の決まりは 0003 の冒頭にある。uid の形と入れ方は 0011 の冒頭と同じ。
--
-- 主キーは URL に出さない（ADR-0048）。note.slug は初めて公開するまで書き換わるため
-- （specs/003-note/spec.md の FR-003）、管理画面の URL には使わない。
--
-- 表を作り直す。作り直し方は 0011 と同じ。行を別の表に写してから消し、同じ名前で作り
-- 直した表に行を入れ直す。note を指している表（note_revision・media・syndication）は
-- 作り直さず、外部キーの検査をトランザクションの終わりに送る。
--
-- DROP TABLE は sqlite_sequence の行も消す。消す前の値を写しておき、入れ直した後に戻す
PRAGMA defer_foreign_keys = on;

CREATE TABLE note_sequence_copy AS
SELECT name, seq FROM sqlite_sequence WHERE name = 'note';

CREATE TABLE note_copy AS SELECT * FROM note;

DROP TABLE note;

-- 列の意味は 0005 と同じ。uid だけを足す
CREATE TABLE note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 管理画面の URL に出す識別子。形と入れ方は 0011 の冒頭のとおり
  uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (
    length(uid) = 32 AND uid NOT GLOB '*[^0-9a-f]*'
  ),
  -- URL に出す識別子。削除した note を含めて重ならない（specs/003-note/spec.md の FR-002）
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  -- draft は下書き、published は訪問者に見せる。作ったときは下書き
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 最後に公開した版。下書きに戻した note でも残す（specs/003-note/spec.md の FR-014）
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
  CHECK ((published_revision_id IS NULL) = (published_at IS NULL)),
  CHECK (status = 'draft' OR published_revision_id IS NOT NULL),
  CHECK ((card_image = 'media') = (card_media_id IS NOT NULL)),
  FOREIGN KEY (id, published_revision_id) REFERENCES note_revision (note_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (id, card_media_id) REFERENCES media (note_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- uid は列に挙げず、DEFAULT が入れる
INSERT INTO note (
  id, slug, status, published_revision_id, published_at, deleted_at, card_image,
  card_media_id, created_at, updated_at
)
SELECT
  id, slug, status, published_revision_id, published_at, deleted_at, card_image,
  card_media_id, created_at, updated_at
FROM note_copy;

DELETE FROM sqlite_sequence WHERE name = 'note';

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM note_sequence_copy;

DROP TABLE note_sequence_copy;
DROP TABLE note_copy;

-- トリガは DROP TABLE で消えるため、0005 と同じものを作り直す
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

CREATE TRIGGER note_uid_fixed
BEFORE UPDATE OF uid ON note
FOR EACH ROW
WHEN NEW.uid IS NOT OLD.uid
BEGIN
  SELECT RAISE(ABORT, 'note_uid_fixed');
END;
