-- resume から limited_token_hash を外す。書き方の決まりは 0003 の冒頭にある。
--
-- 限定公開用の URL は /resume/{slug} だけで、slug（題や提出先から推測できない uid）が開く鍵を
-- 兼ねる。URL に別の鍵を持たないため、鍵のハッシュの列を持たない
--
-- limited_token_hash は UNIQUE と表の CHECK に含まれ、ALTER TABLE DROP COLUMN で外せないため、
-- 表を作り直す。行はそのまま移す。作り直し方は 0008 と同じ。resume を指す子の表
-- （resume_career・resume_project・resume_education・resume_skill_override）の行は残し、
-- 外部キーの検査をトランザクションの終わりに送る。
--
-- DROP TABLE は sqlite_sequence の行も消す。消す前の値を写しておき、入れ直した後に戻す
PRAGMA defer_foreign_keys = on;

CREATE TABLE sequence_copy AS
SELECT name, seq FROM sqlite_sequence WHERE name = 'resume';

CREATE TABLE resume_copy AS SELECT * FROM resume;

DROP TABLE resume;

-- 職務経歴書の版。複数持つ。限定公開用は提出先ごとに作って渡し、公開用はサイトで公開する
CREATE TABLE resume (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- URL に出す識別子。note.slug と同じ形。限定公開用は、題や提出先から推測できない uid を
  -- アプリケーションが入れ、URL を開く鍵を兼ねる。出し直すと新しい uid に書き換わり、
  -- 古い URL は読めなくなる
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL,
  -- limited は限定公開用で、職歴と実績をすべて実際の値で写す。public は公開用で、
  -- 職務経歴書を作ったときに秘匿化していた職歴と実績は秘匿化した値を、それ以外は実際の値を写す。
  -- 既定は limited。作った後に変えない（下のトリガ）
  audience TEXT NOT NULL DEFAULT 'limited' CHECK (audience IN ('limited', 'public')),
  -- draft は下書き、published は読み手に見せる
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- 限定公開用の URL の期限。NULL なら期限を設けない。期限が切れたら読めなくなるが、
  -- 行は消さない。期限を延ばせば、もう一度読める
  limited_expires_at TEXT CHECK (
    limited_expires_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', limited_expires_at) IS limited_expires_at
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- 公開用は期限を持たない
  CHECK (audience = 'limited' OR limited_expires_at IS NULL)
) STRICT;

INSERT INTO resume (
  id, slug, title, audience, status, limited_expires_at, created_at, updated_at
)
SELECT
  id, slug, title, audience, status, limited_expires_at, created_at, updated_at
FROM resume_copy;

DELETE FROM sqlite_sequence WHERE name = 'resume';

INSERT INTO sqlite_sequence (name, seq) SELECT name, seq FROM sequence_copy;

DROP TABLE sequence_copy;
DROP TABLE resume_copy;

-- 索引とトリガは DROP TABLE で消えるため、0008 と同じものを作り直す

-- 公開用の職務経歴書は 1 つだけ
CREATE UNIQUE INDEX resume_public ON resume (audience) WHERE audience = 'public';

-- 公開用と限定公開用は、載せる値が違う。作った後に入れ替えると、限定公開用に
-- 載せた実際の値が公開用として出る
CREATE TRIGGER resume_audience_fixed
BEFORE UPDATE OF audience ON resume
FOR EACH ROW
WHEN NEW.audience IS NOT OLD.audience
BEGIN
  SELECT RAISE(ABORT, 'resume_audience_fixed');
END;

CREATE TRIGGER resume_updated_at
AFTER UPDATE ON resume
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE resume SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
