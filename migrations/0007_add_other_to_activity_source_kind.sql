-- activity_source.kind に other を足す。書き方の決まりは 0003 の冒頭にある。
--
-- CHECK の値は ALTER TABLE で変えられないため、表を作り直す。行はそのまま移す。
--
-- activity と fetch_result が activity_source を指す。D1 は外部キーの検査を切れず、
-- 検査をトランザクションの終わりに送ることだけができる
-- （https://developers.cloudflare.com/d1/sql-api/foreign-keys/ の defer_foreign_keys）。
-- DROP TABLE は行を消してから表を消すため、子の行の数だけ違反が数えられる。
-- 作り直した表を RENAME で同じ名前にしても、この数は減らず、終わりの検査で失敗する。
-- そこで、行を別の表に写してから消し、同じ名前で作り直した表に行を入れ直す。
-- 親の行を入れると、その行を指す子の行の違反が数えから外れる
PRAGMA defer_foreign_keys = on;

CREATE TABLE activity_source_copy (source TEXT, kind TEXT) STRICT;

INSERT INTO activity_source_copy (source, kind) SELECT source, kind FROM activity_source;

DROP TABLE activity_source;

CREATE TABLE activity_source (
  source TEXT PRIMARY KEY,
  -- 一覧での分類。UI はこの値で表示を分ける。article は記事、life_event は life event、
  -- other はその他。値の名前は project.kind の other に合わせる
  kind TEXT NOT NULL CHECK (kind IN ('article', 'life_event', 'other'))
) STRICT;

INSERT INTO activity_source (source, kind) SELECT source, kind FROM activity_source_copy;

DROP TABLE activity_source_copy;

-- unlisted は取得元として登録していないサイトで、記事に限らないため other にする
UPDATE activity_source SET kind = 'other' WHERE source = 'unlisted';
