-- activity の表を作る（#72 の ER 図）。書き方の決まりは 0003 の冒頭にある。
--
-- activity が持つのは、外部の取得元から取った項目と、life event だけである。
-- note・project・career は activity に行を持たない。一覧はそれぞれの表から読む
-- （#72 の 2026-10-24 と 2026-10-26 の決定）

-- activity の出どころ。kind は一覧での分類
CREATE TABLE activity_source (
  source TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('article', 'life_event'))
) STRICT;

-- activity の CHECK が値を名指しする 2 つの出どころ。外部の取得元は、取得を作るときに足す
-- - life_event: オーナーが手で書く出来事
-- - unlisted: 取得元として登録していないサイトの記事。URL で同じ記事かを判定する
INSERT INTO activity_source (source, kind) VALUES
  ('life_event', 'life_event'),
  ('unlisted', 'article');

CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL REFERENCES activity_source (source),
  -- 取得元での項目の ID。取得元が ID を返さないときは NULL にし、url で判定する
  external_id TEXT,
  url TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  -- 取得元が返した公開日時
  published_at TEXT CHECK (
    published_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS published_at
  ),
  -- life event の起きた日（YYYY-MM-DD）
  happened_on TEXT CHECK (
    happened_on IS NULL
    OR strftime('%Y-%m-%d', happened_on) IS happened_on
  ),
  -- 一覧の並びの日時。日付と日時は、文字列の並びと時刻の並びが一致する
  sort_at TEXT GENERATED ALWAYS AS (coalesce(published_at, happened_on)) VIRTUAL NOT NULL,
  -- life event のカードの画像。この activity が持つ media だけを指す（下の複合の外部キー）
  card_media_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS created_at
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS updated_at
  ),
  -- life event だけが起きた日と画像を持つ。ほかの行は URL を持つ
  CHECK ((source = 'life_event') = (happened_on IS NOT NULL)),
  CHECK (source = 'life_event' OR url IS NOT NULL),
  CHECK (source = 'life_event' OR card_media_id IS NULL),
  -- 取得し直したときに同じ項目を 2 行にしない
  UNIQUE (source, external_id),
  -- media は 0005 で作る。検査をトランザクションの終わりに送る理由は 0003 の project と同じ
  FOREIGN KEY (id, card_media_id) REFERENCES media (activity_id, id)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

-- 取得元が ID を返さない項目を、URL で 1 行にする
CREATE UNIQUE INDEX activity_source_url ON activity (source, url) WHERE external_id IS NULL;

-- 一覧を新しい順に読む
CREATE INDEX activity_sort_at ON activity (sort_at, id);

-- 外部の取得元ごとの、最新の取得の成否
CREATE TABLE fetch_result (
  source TEXT PRIMARY KEY REFERENCES activity_source (source),
  fetched_at TEXT NOT NULL CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', fetched_at) IS fetched_at
  ),
  is_ok INTEGER NOT NULL CHECK (is_ok IN (0, 1)),
  -- 失敗の理由
  reason TEXT,
  last_succeeded_at TEXT CHECK (
    last_succeeded_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', last_succeeded_at) IS last_succeeded_at
  )
) STRICT;

CREATE TRIGGER activity_updated_at
AFTER UPDATE ON activity
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE activity SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
