-- 組織・職歴・実績・学歴・スキルの表を作る（#72 の ER 図）。
--
-- 書き方は 0002 に合わせる。0004〜0006 もこの決まりに従う。
-- - 外部キーは、物理削除のときの扱いを書かない（NO ACTION）。子の行が残っていれば
--   削除はエラーで止まる。表を作り直す migration で、子の行が黙って消えないため
--   （#72 の 2026-10-24 の決定）
-- - id は AUTOINCREMENT にする。削除した行の id を使い回すと、別に開いたままの
--   編集の画面からの保存が、後から作った別の行を上書きする（#72 の 2026-10-26 の決定）。
--   訪問者に見せる URL は id でなく slug で作る
-- - 暦の日付は YYYY-MM-DD、日時は Date.prototype.toISOString() の形（UTC）。
--   形を strftime() で確かめる。読めない値は strftime() が NULL を返すため IS で比べる。
--   暦の日付は時刻もタイムゾーンも持たない。日が分からないときは便宜的な日を入れる
--   （#72 の 2026-10-26・2026-10-27 の決定）
-- - created_at と updated_at は DB が入れる。updated_at は行を書き換えたときに
--   トリガーが入れ直す。アプリケーションが入れ忘れないため
-- - 真偽は 0 と 1 の INTEGER。名前は is_ で始める（ADR-0043）
-- - 外部キーの子の列には索引を張る

-- 組織。会社・団体・自営業（個人）を含む。職歴と実績が指し、組織名の表記をぶれさせない
CREATE TABLE organization (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 組織名の実際の値。直すと、指している職歴と実績に反映する。作った職務経歴書は
  -- 作ったときの値を写して持つので変わらない
  name TEXT NOT NULL UNIQUE,
  -- 秘匿化した組織名。is_masked の職歴と実績を、訪問者と公開用の職務経歴書に出すときに使う
  name_masked TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 職歴。組織にオーナーが所属して働いた履歴。一覧（activity_feed）に 1 行として並ぶ
CREATE TABLE career (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 所属した組織
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  -- 肩書
  role TEXT NOT NULL,
  -- 所属の始まりの日。一覧はこの日で並べる
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  -- 所属の終わりの日。NULL なら所属が続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  -- 説明の本文。画像とそのキャプションも本文の中に置く
  description TEXT,
  url TEXT,
  -- 1 なら、訪問者には organization.name_masked で出し、description を伏せる。
  -- 既定値を置かず、作る画面で選ばせる
  is_masked INTEGER NOT NULL CHECK (is_masked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

CREATE INDEX career_organization_id ON career (organization_id);

-- 実績。いずれかの組織で担当した仕事・企画と、活動（勉強会の開催・登壇など）。
-- 職歴とは直接つながらない。一覧（activity_feed）に 1 行として並ぶ
CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- その実績を行ったときに所属していた組織。職歴の組織と違うことがある。
  -- 個人開発は、自営業（個人）の組織の行を指す
  organization_id INTEGER NOT NULL REFERENCES organization (id),
  -- application はアプリ、talk は登壇、event はイベント、other はその他。
  -- 値を足すときは、表を作り直す migration を書く
  kind TEXT NOT NULL CHECK (kind IN ('application', 'talk', 'event', 'other')),
  -- URL に出す識別子。note.slug と同じ形
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 100
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  -- 題の実際の値
  title TEXT NOT NULL,
  -- 秘匿化した題。is_masked の実績を、訪問者と公開用の職務経歴書に出すときに使う
  title_masked TEXT NOT NULL,
  -- 1 なら、訪問者には title_masked と organization.name_masked で出し、description を伏せる。
  -- 既定値を置かず、作る画面で選ばせる
  is_masked INTEGER NOT NULL CHECK (is_masked IN (0, 1)),
  -- 1 ならハイライトとして表示する（ADR-0003）。既定値を置かず、作る画面で選ばせる
  is_highlighted INTEGER NOT NULL CHECK (is_highlighted IN (0, 1)),
  -- 代表画像。この実績が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  -- 始まりの日。一覧はこの日で並べる。スキルの経験年数は、実績の期間から求める
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  -- 終わりの日。NULL なら続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  -- 説明の本文。画像とそのキャプションも本文の中に置く。秘匿化した値は持たない
  description TEXT,
  -- 関連 URL。1 件の実績に 1 つ
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- media は 0005 で作る。media.project_id もこの表を指すため、検査をトランザクションの
  -- 終わりに送る。実績と画像を同じトランザクションで消せるようにするため
  FOREIGN KEY (id, card_media_id) REFERENCES media (project_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE INDEX project_organization_id ON project (organization_id);

-- 学歴。職務経歴書を通してだけ出す（#72 の 2026-10-26 の決定）
CREATE TABLE education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school TEXT NOT NULL,
  department TEXT,
  -- 始まりの日
  started_on TEXT NOT NULL CHECK (
    strftime('%Y-%m-%d', started_on) IS started_on
  ),
  -- 終わりの日。NULL なら続いている
  ended_on TEXT CHECK (
    ended_on IS NULL
    OR (strftime('%Y-%m-%d', ended_on) IS ended_on AND ended_on >= started_on)
  ),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- スキル。実績の「使った技術」につなぐ。職歴のスキルは、その職歴に属する実績のスキルを
-- 合わせて求める
CREATE TABLE skill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 大文字と小文字の違いだけの重複を拒む（TypeScript と typescript）。重複すると、
  -- 経験年数が 2 行に分かれて計算される
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  -- 経験年数を手で上書きする値。NULL なら、そのスキルを付けた実績の期間をつなぎ、
  -- 重なりを除いた長さから求めた値を使う。求めた値は保存しない
  years_override INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  )
) STRICT;

-- 実績で使ったスキル。スキルをつなぐのは実績だけ
CREATE TABLE project_skill (
  project_id INTEGER NOT NULL REFERENCES project (id),
  skill_id INTEGER NOT NULL REFERENCES skill (id),
  PRIMARY KEY (project_id, skill_id)
) STRICT;

CREATE INDEX project_skill_skill_id ON project_skill (skill_id);

CREATE TRIGGER organization_updated_at
AFTER UPDATE ON organization
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE organization SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER career_updated_at
AFTER UPDATE ON career
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE career SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER project_updated_at
AFTER UPDATE ON project
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE project SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER education_updated_at
AFTER UPDATE ON education
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE education SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER skill_updated_at
AFTER UPDATE ON skill
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE skill SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
