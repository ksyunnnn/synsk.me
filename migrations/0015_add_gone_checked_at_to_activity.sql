-- activity に、取得元で消えたかを最後に確かめた日時 gone_checked_at を足す。書き方の決まりは
-- 0003 の冒頭にある。
--
-- 004 の取得のユースケースが、RSS に載らない古い記事の URL を 1 本ずつ取り直して、取得元で
-- 消えたかを確かめた日時を書く。1 回の実行で確かめる本数に上限を持ち、この列の古い順（NULL が
-- 先）に回す（004 の tasks.md の T048、004 の spec の FR-017。issue #219 の 2026-11-09 の
-- 宣言 https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6733377429）。
-- updated_at は行を書き換えるたびにトリガが入れ直すため、確かめた日時に使えない。
--
-- 外部の activity の行だけが持つ。life event は synsk.me の中で作る行で、取得元を持たないため
-- NULL にする（CHECK）。日時の形は published_at と同じ。
--
-- NULL を許し既定値を持たない列は ALTER TABLE ADD COLUMN で足せるため、表を作り直さない。
-- CHECK は既にある行にも当たり、既にある行の値は NULL になる
-- （https://www.sqlite.org/lang_altertable.html#altertabaddcol）
ALTER TABLE activity ADD COLUMN gone_checked_at TEXT CHECK (
  gone_checked_at IS NULL
  OR (
    source <> 'life_event'
    AND strftime('%Y-%m-%dT%H:%M:%fZ', gone_checked_at) IS gone_checked_at
  )
);

-- gone_checked_at だけを書いた UPDATE では updated_at を進めない。updated_at は管理画面の
-- 同時編集で比べる値で（001 の FR-042 と同じ形）、定期実行の確かめで進むと、オーナーの編集が
-- 競合で止まるため。トリガは SET に挙げた列で動く（AFTER UPDATE OF、
-- https://www.sqlite.org/lang_createtrigger.html）。挙げるのは、updated_at・gone_checked_at と
-- 生成列の sort_at を除く activity のすべての列。activity に列を足す migration は、このトリガを
-- 作り直して足した列を挙げる
DROP TRIGGER activity_updated_at;

CREATE TRIGGER activity_updated_at
AFTER UPDATE OF
  id, uid, source, external_id, url, title, description, image_url, published_at, happened_on,
  card_media_id, created_at, slug
ON activity
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE activity SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
