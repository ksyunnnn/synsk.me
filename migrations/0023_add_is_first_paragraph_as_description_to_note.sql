-- note に、説明文が空のときに本文の最初の段落を説明に使うか is_first_paragraph_as_description を
-- 足す。書き方の決まりは 0003 の冒頭にある。
--
-- オーナーは note ごとに、説明文が空のときの説明を選ぶ。1 は本文の最初の段落を使い、0 は何も
-- 出さない。既定は 1（specs/003-note/spec.md の FR-034、2026-11-10 のオーナーの決定。
-- https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6766542397 ）。説明文を持つ
-- 版では、この列にかかわらず説明文を出す
--
-- 版（note_revision）でなく note に持つ。代表画像の出どころ（note.card_image）と同じく、note の
-- 見せ方の設定で、版の中身ではないため。版は書き換えないので、版に持つと選び直すたびに版を
-- 足すことになる（specs/003-note/research.md の R19）
--
-- NOT NULL で既定値が定数の列は ALTER TABLE ADD COLUMN で足せるため、表を作り直さない。既にある
-- 行は 1 になり、CHECK は既にある行にも当たる
-- （https://www.sqlite.org/lang_altertable.html#altertabaddcol）。トリガ note_updated_at は
-- どの列の UPDATE でも updated_at を進めるので、作り直さない
ALTER TABLE note ADD COLUMN is_first_paragraph_as_description INTEGER NOT NULL DEFAULT 1 CHECK (
  is_first_paragraph_as_description IN (0, 1)
);
