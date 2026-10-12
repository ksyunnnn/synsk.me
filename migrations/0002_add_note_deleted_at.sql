-- note の削除を、行を消さずに削除した日時を入れる形にする
-- （specs/005-note-write-and-read/data-model.md）。
--
-- deleted_at が NULL でない note が、削除した note である。訪問者にも作り手の
-- note の一覧にも出さない。戻すときは NULL に戻す。note_publication の行は
-- 削除しても残し、戻した note が削除する前の状態（下書きか公開か）に戻るようにする。
--
-- slug の UNIQUE は削除した note にもかかる。削除した note の slug を別の note に
-- 渡さず、戻すときに slug が重ならないようにするため（spec の FR-006）

-- 日時の形は note_publication.first_published_at と同じ
ALTER TABLE note ADD COLUMN deleted_at TEXT CHECK (
  deleted_at IS NULL
  OR strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at) IS deleted_at
);
