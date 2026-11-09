/**
 * workerd の検査が、作り物の activity と取得の結果の行を D1 に入れる道具。値はすべて作り物。
 * Repository の検査の前提を、検査する実装に頼らずに作るため、行は SQL で入れる
 */

export type ActivityRowInput = {
  source: string;
  externalId?: string | null;
  url?: string | null;
  title?: string | null;
  publishedAt?: string | null;
  imageUrl?: string | null;
  happenedOn?: string | null;
  slug?: string | null;
  createdAt?: string;
};

export const insertActivity = async (db: D1Database, input: ActivityRowInput): Promise<number> => {
  const row = await db
    .prepare(
      'INSERT INTO activity (source, external_id, url, title, published_at, image_url, happened_on, slug, created_at) ' +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, coalesce(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))) RETURNING id",
    )
    .bind(
      input.source,
      input.externalId ?? null,
      input.url ?? null,
      input.title ?? null,
      input.publishedAt ?? null,
      input.imageUrl ?? null,
      input.happenedOn ?? null,
      input.slug ?? null,
      input.createdAt ?? null,
    )
    .first<{ id: number }>();
  if (!row) throw new Error('activity に行を入れられなかった');
  return row.id;
};

/** 作り物の life event。取得の書き込みが書き換えないことを確かめるために入れる */
export const insertLifeEvent = (db: D1Database, slug = 'fake-life-event') =>
  insertActivity(db, {
    source: 'life_event',
    title: '作り物の出来事',
    happenedOn: '2020-04-01',
    slug,
  });

export const readActivityRows = (db: D1Database, source: string) =>
  db
    .prepare(
      'SELECT id, external_id, url, title, published_at, image_url, created_at FROM activity WHERE source = ? ORDER BY id',
    )
    .bind(source)
    .all<{
      id: number;
      external_id: string | null;
      url: string;
      title: string | null;
      published_at: string | null;
      image_url: string | null;
      created_at: string;
    }>()
    .then((result) => result.results);

export const readFetchResult = (db: D1Database, source: string) =>
  db
    .prepare(
      'SELECT fetched_at, is_ok, reason, last_succeeded_at FROM fetch_result WHERE source = ?',
    )
    .bind(source)
    .first<{
      fetched_at: string;
      is_ok: number;
      reason: string | null;
      last_succeeded_at: string | null;
    }>();

/** 検査の間で残さない。media は activity を指すので先に消す */
export const deleteActivityRows = (db: D1Database) =>
  db.batch([
    db.prepare('DELETE FROM media WHERE activity_id IS NOT NULL'),
    db.prepare('DELETE FROM activity'),
    db.prepare('DELETE FROM fetch_result'),
  ]);
