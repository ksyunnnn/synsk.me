-- note と note_revision を作り直し、画像・転載先・URL カードの表を作る（#72 の ER 図）。
-- 書き方の決まりは 0003 の冒頭にある。
--
-- 0002 の表のデータは移さない。
--
-- 作り直した表の形:
-- - note_revision.note_id は NO ACTION（決まりは 0003 の冒頭）
-- - note は代表画像（card_image・card_media_id）と created_at・updated_at を持ち、
--   note_revision は description を持つ
-- - note.published_revision_id は、同じ note の版だけを指す複合の外部キー
--
-- note と note_revision、note と media は互いを指す。公開した note を完全に消すには、
-- 同じトランザクションで media・syndication・note_revision・note の順に消す。
-- note から版と画像を指す外部キーは、検査をトランザクションの終わりに送る
-- （DEFERRABLE INITIALLY DEFERRED）。送らないと、版を先に消せば note が止め、
-- note を先に消せば版が止める。note.published_at は一度入れたら変えられないため、
-- 指す先を空にしてから消す手順も取れない

-- 0002 の note_revision は ON DELETE CASCADE を持つ。DROP TABLE note は行を消してから
-- 表を消すため、版も一緒に消える。外部キーの検査はこの migration の終わりに送る
PRAGMA defer_foreign_keys = on;

DROP TABLE note;
DROP TABLE note_revision;

CREATE TABLE note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- URL に出す識別子。削除した note を含めて重ならない。削除した note の slug を別の note に渡さず、
  -- 戻すときに slug が重ならないようにするため（specs/005-note-write-and-read の FR-006）
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  -- draft は下書き、published は訪問者に見せる。作ったときは下書き
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 最後に公開した版。下書きで戻した note でも残す（specs/005-note-write-and-read の FR-018）
  published_revision_id INTEGER,
  -- 初めて公開した日時。一度入れたら変えない（下のトリガ）
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- 削除した日時。NULL でなければ削除した note である。戻すと NULL に戻る。
  -- 画面の削除はこの列を入れる論理削除で、行は消さない
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

-- note ごとの最新の版を引く。note.published_revision_id の外部キーが指す先でもある
CREATE UNIQUE INDEX note_revision_note_id ON note_revision (note_id, id);

-- 画像。実体は R2 にあり、storage_key で指す。持ち主の列はちょうど 1 つだけ入る。
-- 職歴・実績・note の画像は、それぞれの本文の中から指す
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 持ち主の note
  note_id INTEGER REFERENCES note (id),
  -- 持ち主の実績
  project_id INTEGER REFERENCES project (id),
  -- 持ち主の職歴
  career_id INTEGER REFERENCES career (id),
  -- 持ち主の life event
  activity_id INTEGER REFERENCES activity (id),
  -- R2 のキー。R2 のバケットは公開せず、Worker を通して配る
  storage_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  CHECK (
    (note_id IS NOT NULL) + (project_id IS NOT NULL)
    + (career_id IS NOT NULL) + (activity_id IS NOT NULL) = 1
  )
) STRICT;

-- *.card_media_id の複合の外部キーが指す先。持ち主の列の索引も兼ねる
CREATE UNIQUE INDEX media_note_id ON media (note_id, id);
CREATE UNIQUE INDEX media_project_id ON media (project_id, id);
CREATE UNIQUE INDEX media_activity_id ON media (activity_id, id);
CREATE INDEX media_career_id ON media (career_id);

-- note を転載した先の URL（POSSE）
CREATE TABLE syndication (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 転載した note
  note_id INTEGER NOT NULL REFERENCES note (id),
  -- 転載先の URL。この URL と一致する外部の activity は一覧から除く（ADR-0006）
  url TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  )
) STRICT;

CREATE INDEX syndication_note_id ON syndication (note_id);

-- URL カードの情報。版の外に持ち、本文の URL で引く
CREATE TABLE link_preview (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 本文に書かれた参照先の URL
  url TEXT NOT NULL UNIQUE,
  -- 参照先から取った題
  title TEXT,
  -- 参照先の代表の画像の URL。画像の出し方は #186 が持つ
  image_url TEXT,
  -- 参照先から取った日時
  fetched_at TEXT NOT NULL CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', fetched_at) IS fetched_at
  )
) STRICT;

-- 版を書き換えない（specs/005-note-write-and-read の FR-021）
CREATE TRIGGER note_revision_immutable
BEFORE UPDATE ON note_revision
BEGIN
  SELECT RAISE(ABORT, 'note_revision_immutable');
END;

-- 公開した note の slug を変えない。公開した URL を変えないため（specs/005-note-write-and-read の FR-007）
CREATE TRIGGER note_slug_fixed_after_publication
BEFORE UPDATE OF slug ON note
FOR EACH ROW
WHEN NEW.slug <> OLD.slug AND OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'note_slug_fixed_after_publication');
END;

-- 初めて公開した日時を変えない。公開し直しても公開日は変わらない（specs/005-note-write-and-read の FR-004）
CREATE TRIGGER note_published_at_fixed
BEFORE UPDATE OF published_at ON note
FOR EACH ROW
WHEN OLD.published_at IS NOT NULL AND NEW.published_at IS NOT OLD.published_at
BEGIN
  SELECT RAISE(ABORT, 'note_published_at_fixed');
END;

-- 公開する版は、同じ note の、題が空でない版に限る。同じ note であることは外部キーも
-- 確かめるが、外部キーの検査はトランザクションの終わりに送るため、ここで先に止める
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
