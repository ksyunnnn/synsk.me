import 'server-only';

import type {
  ActivityRepository,
  ItemChanges,
  StoredItem,
} from '@/features/activity/domain/activity-repository';

/**
 * `ActivityRepository` の D1 の実装（docs/SOFTWARE_DESIGN.md の Repository）。行の型はこの
 * ファイルの中だけで書く。取得の書き込みの文は、どれも `source <> 'life_event'` を条件にし、
 * life event の行を書き換えない（specs/004-external-activity/research.md の R13、FR-032）。
 * 1 つの取得元の書き込みと取得の結果は 1 回の `batch()`（1 つのトランザクション）で送る（R4）
 */

type StoredRow = {
  id: number;
  external_id: string | null;
  url: string;
  title: string | null;
  published_at: string | null;
  image_url: string | null;
};

/** `ItemChanges` の項目と列の名前 */
const COLUMNS = {
  url: 'url',
  title: 'title',
  publishedAt: 'published_at',
  imageUrl: 'image_url',
} as const satisfies Record<keyof ItemChanges, string>;

const UPSERT_FETCH_RESULT =
  'INSERT INTO fetch_result (source, fetched_at, is_ok, reason, last_succeeded_at) VALUES (?, ?, ?, ?, ?) ' +
  'ON CONFLICT (source) DO UPDATE SET fetched_at = excluded.fetched_at, is_ok = excluded.is_ok, ' +
  'reason = excluded.reason, last_succeeded_at = coalesce(excluded.last_succeeded_at, fetch_result.last_succeeded_at)';

export const createD1ActivityRepository = (db: D1Database): ActivityRepository => ({
  listStoredForRefresh: async (source) => {
    const { results } = await db
      .prepare(
        "SELECT id, external_id, url, title, published_at, image_url FROM activity WHERE source = ? AND source <> 'life_event' ORDER BY id",
      )
      .bind(source)
      .all<StoredRow>();
    return results.map((row): StoredItem => ({
      id: row.id,
      externalId: row.external_id,
      url: row.url,
      title: row.title,
      publishedAt: row.published_at,
      imageUrl: row.image_url,
    }));
  },

  applyRefresh: async (source, plan, result) => {
    const inserts = plan.inserts.map((item) =>
      db
        .prepare(
          "INSERT INTO activity (source, external_id, url, title, published_at, image_url) SELECT ?, ?, ?, ?, ?, ? WHERE ? <> 'life_event'",
        )
        .bind(
          source,
          item.externalId ?? null,
          item.url,
          item.title,
          item.publishedAt,
          item.imageUrl ?? null,
          source,
        ),
    );
    const updates = plan.updates
      .filter(({ changes }) => Object.keys(changes).length > 0)
      .map(({ id, changes }) => {
        const entries = (Object.keys(changes) as (keyof ItemChanges)[]).map(
          (key) => [COLUMNS[key], changes[key] ?? null] as const,
        );
        return db
          .prepare(
            `UPDATE activity SET ${entries.map(([column]) => `${column} = ?`).join(', ')} ` +
              "WHERE id = ? AND source = ? AND source <> 'life_event'",
          )
          .bind(...entries.map(([, value]) => value), id, source);
      });
    await db.batch([
      ...inserts,
      ...updates,
      db
        .prepare(UPSERT_FETCH_RESULT)
        .bind(source, result.fetchedAt, 1, result.reason, result.fetchedAt),
    ]);
  },

  recordFetchFailure: async (source, fetchedAt, reason) => {
    await db.prepare(UPSERT_FETCH_RESULT).bind(source, fetchedAt, 0, reason, null).run();
  },

  listFetchedAt: async () => {
    const { results } = await db
      .prepare('SELECT source, fetched_at FROM fetch_result')
      .all<{ source: string; fetched_at: string }>();
    return Object.fromEntries(results.map((row) => [row.source, row.fetched_at]));
  },
});
