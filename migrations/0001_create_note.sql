-- note を書いて公開し、読む（specs/005-note-write-and-read/data-model.md）。
--
-- 書き換えている内容を note に、訪問者に見せている内容を note_publication に持つ。
-- note_publication に行があれば公開、なければ下書き。状態を表す列は持たない。
--
-- 文字数は length() で数える。TEXT の length() はコードポイントの数を返し、
-- src/features/note/domain/note.ts の数え方と一致する。

-- id は削除した note のものを使い回さない。別に開いたままの編集の画面からの
-- 保存が、後から作った別の note を上書きしないようにするため
CREATE TABLE note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL CHECK (length(title) <= 200),
  body TEXT NOT NULL CHECK (length(body) <= 100000)
) STRICT;

CREATE TABLE note_publication (
  note_id INTEGER PRIMARY KEY REFERENCES note (id) ON DELETE CASCADE,
  -- 空の題では公開しない
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT NOT NULL CHECK (length(body) <= 100000),
  -- Date.prototype.toISOString() の形（UTC）。文字列の並びと時刻の並びが一致する。
  -- 形を GLOB で書くと、D1 が「LIKE or GLOB pattern too complex」で拒む。日時として
  -- 読めない値は strftime() が NULL を返すため、= ではなく IS で比べる
  first_published_at TEXT NOT NULL CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', first_published_at) IS first_published_at
  )
) STRICT;

-- 公開した note の slug を変えない。公開した URL を変えないため（spec の FR-007）
CREATE TRIGGER note_slug_fixed_after_publication
BEFORE UPDATE OF slug ON note
FOR EACH ROW
WHEN NEW.slug <> OLD.slug
  AND EXISTS (SELECT 1 FROM note_publication WHERE note_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'note_slug_fixed_after_publication');
END;
