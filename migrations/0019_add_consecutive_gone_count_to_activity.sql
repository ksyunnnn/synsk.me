-- activity に、取り直した URL が続けて 404 を返した回数 consecutive_gone_count を足す。書き方の
-- 決まりは 0003 の冒頭にある。
--
-- 004 の取得のユースケースは、RSS に載らない古い記事の URL を取り直し、404 なら取得元で消えた
-- 候補にする（specs/004-external-activity/research.md の R6、tasks.md の T048）。1 回の 404 では
-- 消さず、続けて 2 回 404 を返したら消す。行を消すと取り消せないので、1 回だけの誤った 404
-- で消さないため（docs/SOFTWARE_DESIGN.md の原則 2「止まる over 危ない方へ進む」。2026-11-09、
-- PM の決定）。404 を返したら 1 足し、2xx と判定しない応答（5xx・3xx・ほかの 4xx など）では 0 に
-- 戻す（004 の research.md の R6）。書くのは 004 の取得のユースケース
--
-- 外部の activity の行だけが 0 より大きい値を持つ。life event は取得元を持たないので 0（CHECK）。
-- 列の名前は、続けて（consecutive）、消えたと返した（gone。gone_checked_at と同じ語）、回数
-- （count）。docs/SOFTWARE_DESIGN.md の「列の名前を意味ごとに1つにする」は回数の列の接尾辞を
-- 決めていないので、意味を英語の語順で並べた
--
-- NOT NULL で既定値が定数の列は ALTER TABLE ADD COLUMN で足せるため、表を作り直さない。既にある
-- 行は 0 になり、CHECK は既にある行にも当たる
-- （https://www.sqlite.org/lang_altertable.html#altertabaddcol）
--
-- この列だけを書いた UPDATE では updated_at を進めない。理由は gone_checked_at と同じ（0015 の
-- 注釈）。トリガ activity_updated_at は、updated_at を進める列を AFTER UPDATE OF に挙げる形で、
-- この列を挙げないので、作り直さない
ALTER TABLE activity ADD COLUMN consecutive_gone_count INTEGER NOT NULL DEFAULT 0 CHECK (
  consecutive_gone_count >= 0
  AND (source <> 'life_event' OR consecutive_gone_count = 0)
);
