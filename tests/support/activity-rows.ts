/**
 * workerd と結合の検査が、作り物の外部の activity・life event・画像の記録・取得の結果の行を
 * D1 に入れる道具。値はすべて作り物。
 *
 * 行は Repository を通さずに SQL で入れる。Repository の検査の前提を、検査する実装に頼らずに
 * 作るため。各関数は入れた行の id を返す
 */

export type ExternalActivityRowInput = {
  source?: string;
  externalId?: string | null;
  url?: string;
  title?: string;
  publishedAt?: string;
  imageUrl?: string | null;
};

export const insertExternalActivity = async (
  db: D1Database,
  input: ExternalActivityRowInput = {},
): Promise<number> => {
  const row = await db
    .prepare(
      `INSERT INTO activity (source, external_id, url, title, published_at, image_url)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      input.source ?? 'unlisted',
      input.externalId ?? null,
      input.url ?? `https://example.com/fake-${crypto.randomUUID()}`,
      input.title ?? '作り物の記事',
      input.publishedAt ?? '2026-01-01T00:00:00.000Z',
      input.imageUrl ?? null,
    )
    .first<{ id: number }>();
  if (!row) throw new Error('activity に行を入れられなかった');
  return row.id;
};

export type LifeEventRowInput = {
  slug?: string;
  title?: string;
  description?: string | null;
  happenedOn?: string;
};

export const insertLifeEvent = async (
  db: D1Database,
  input: LifeEventRowInput = {},
): Promise<number> => {
  const row = await db
    .prepare(
      `INSERT INTO activity (source, slug, title, description, happened_on)
       VALUES ('life_event', ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      input.slug ?? crypto.randomUUID(),
      input.title ?? '作り物の出来事',
      input.description ?? null,
      input.happenedOn ?? '2020-04-01',
    )
    .first<{ id: number }>();
  if (!row) throw new Error('life event を入れられなかった');
  return row.id;
};

/** life event の画像の記録を入れ、代表画像にする */
export const insertLifeEventCardMedia = async (
  db: D1Database,
  activityId: number,
): Promise<number> => {
  const media = await db
    .prepare('INSERT INTO media (activity_id, storage_key) VALUES (?, ?) RETURNING id')
    .bind(activityId, `fake/${crypto.randomUUID()}`)
    .first<{ id: number }>();
  if (!media) throw new Error('media に行を入れられなかった');
  await db
    .prepare('UPDATE activity SET card_media_id = ? WHERE id = ?')
    .bind(media.id, activityId)
    .run();
  return media.id;
};

/** activity・media・取得の結果の行をすべて消す */
export const deleteActivityRows = async (db: D1Database) => {
  await db.batch([
    db.prepare('UPDATE activity SET card_media_id = NULL'),
    db.prepare('DELETE FROM media WHERE activity_id IS NOT NULL'),
    db.prepare('DELETE FROM activity'),
    db.prepare('DELETE FROM fetch_result'),
  ]);
};
