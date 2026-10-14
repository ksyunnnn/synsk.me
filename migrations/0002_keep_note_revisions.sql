-- note の題と本文を版として残し、削除を行を消さない形にする
-- （specs/005-note-write-and-read/data-model.md）。
--
-- 0001 の表を作り直す。0001 の表のデータは移さない。本番の D1 に入っていたのは
-- 試しに作った note だけで、オーナーが捨ててよいとした（2026-10-14）。
--
-- note は状態と、最後に公開した版を指す。題と本文は note_revision に、保存と公開の
-- たびに1行ずつ足す。版を書き換えない。作り手が書き換えている内容は最新の版、
-- 訪問者に見せる内容は note.published_revision_id の版である。
--
-- 文字数は length() で数える。TEXT の length() はコードポイントの数を返し、
-- src/features/note/domain/note.ts の数え方と一致する。
--
-- 日時は Date.prototype.toISOString() の形（UTC）。文字列の並びと時刻の並びが
-- 一致する。形を GLOB で書くと、D1 が「LIKE or GLOB pattern too complex」で拒む。
-- 日時として読めない値は strftime() が NULL を返すため、= ではなく IS で比べる

DROP TRIGGER note_slug_fixed_after_publication;
DROP TABLE note_publication;
DROP TABLE note;

-- id は削除した note のものを使い回さない。別に開いたままの編集の画面からの
-- 保存が、後から作った別の note を上書きしないようにするため
CREATE TABLE note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 削除した note を含めて重ならない。削除した note の slug を別の note に渡さず、
  -- 戻すときに slug が重ならないようにするため（spec の FR-006）
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 最後に公開した版。下書きで戻した note でも残す（spec の FR-018）
  published_revision_id INTEGER REFERENCES note_revision (id),
  -- 初めて公開した日時。一度入れたら変えない（下のトリガ）
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- 削除した日時。NULL でなければ削除した note である
  deleted_at TEXT CHECK (
    deleted_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS deleted_at
  ),
  -- 公開したことのある note だけが、公開した版と初めて公開した日時を持つ
  CHECK ((published_revision_id IS NULL) = (published_at IS NULL)),
  -- 公開の note は、訪問者に見せる版を持つ
  CHECK (status = 'draft' OR published_revision_id IS NOT NULL)
) STRICT;

CREATE TABLE note_revision (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- note の行を Cloudflare の管理画面から消すと、版も一緒に消える（spec の FR-020）
  note_id INTEGER NOT NULL REFERENCES note (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) <= 200),
  body TEXT NOT NULL CHECK (length(body) <= 100000),
  created_at TEXT NOT NULL CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  )
) STRICT;

-- note ごとの最新の版を引く
CREATE INDEX note_revision_note_id ON note_revision (note_id, id);

-- 版を書き換えない（spec の FR-021）
CREATE TRIGGER note_revision_immutable
BEFORE UPDATE ON note_revision
BEGIN
  SELECT RAISE(ABORT, 'note_revision_immutable');
END;

-- 公開した note の slug を変えない。公開した URL を変えないため（spec の FR-007）
CREATE TRIGGER note_slug_fixed_after_publication
BEFORE UPDATE OF slug ON note
FOR EACH ROW
WHEN NEW.slug <> OLD.slug AND OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'note_slug_fixed_after_publication');
END;

-- 初めて公開した日時を変えない。公開し直しても公開日は変わらない（spec の FR-004）
CREATE TRIGGER note_published_at_fixed
BEFORE UPDATE OF published_at ON note
FOR EACH ROW
WHEN OLD.published_at IS NOT NULL AND NEW.published_at IS NOT OLD.published_at
BEGIN
  SELECT RAISE(ABORT, 'note_published_at_fixed');
END;

-- 公開する版は、同じ note の、題が空でない版に限る
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
