-- activity に、取得元で消えたかを最後に確かめた日時 gone_checked_at を足す。書き方の決まりは
-- 0003 の冒頭にある。
--
-- 004 の取得のユースケースが、取得元で消えたかを確かめた日時を書く
-- （specs/004-external-activity/research.md の R6）。updated_at は行を書き換えるたびに
-- トリガが入れ直すため、確かめた日時に使えない。
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
