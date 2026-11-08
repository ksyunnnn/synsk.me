import 'server-only';

import type { ExternalActivity, FetchResult } from '@/features/activity/domain/activity';
import type {
  ActivityRepository,
  FetchResultInput,
} from '@/features/activity/domain/activity-repository';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { ExternalSource, UrlSource } from '@/features/activity/domain/source';

/**
 * `ActivityRepository` の D1 の実装。行の型はこのファイルの中だけに置き、domain の型に詰め替える
 * （specs/001-career-and-project/research.md の R3 と同じ形）。列と CHECK の正本は migrations/ に
 * ある。複数の文は 1 つの `batch()`（1 つのトランザクション）で送る。
 *
 * どの文も `source <> 'life_event'` の行だけを読み書きし、life event を書き換えない（FR-032）
 */

type ActivityRow = {
  id: number;
  uid: string;
  source: ExternalSource;
  external_id: string | null;
  url: string;
  title: string;
  published_at: string;
  image_url: string | null;
  created_at: string;
};

type FetchResultRow = {
  source: ExternalSource;
  fetched_at: string;
  is_ok: 0 | 1;
  reason: string | null;
  last_succeeded_at: string | null;
};

const COLUMNS = 'id, uid, source, external_id, url, title, published_at, image_url, created_at';
const EXTERNAL = "source <> 'life_event'";

const toActivity = (row: ActivityRow): ExternalActivity => ({
  id: row.id,
  uid: row.uid,
  source: row.source,
  externalId: row.external_id,
  url: row.url,
  title: row.title,
  publishedAt: row.published_at,
  imageUrl: row.image_url,
  createdAt: row.created_at,
});

const isUniqueViolation = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: activity.');

/** 値が変わったときだけ書き換える条件（research.md の R5） */
const CHANGED = `activity.url IS NOT excluded.url OR activity.title IS NOT excluded.title
  OR activity.image_url IS NOT excluded.image_url
  OR activity.published_at IS NOT excluded.published_at`;

const UPDATE_SET = `url = excluded.url, title = excluded.title, image_url = excluded.image_url,
  published_at = excluded.published_at`;

export const createD1ActivityRepository = (db: D1Database): ActivityRepository => {
  /**
   * 1 件を書く。ID を持つ項目は `UNIQUE (source, external_id)` で、持たない項目は部分 UNIQUE
   * 索引 `activity_source_url` で、同じ項目を 1 行にする（FR-008）。値が変わらなければ書かない
   */
  const upsertStatement = (source: ExternalSource, item: FetchedItem) => {
    const conflict =
      item.externalId === null
        ? 'ON CONFLICT (source, url) WHERE external_id IS NULL'
        : 'ON CONFLICT (source, external_id)';
    return db
      .prepare(
        `INSERT INTO activity (source, external_id, url, title, image_url, published_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ${conflict} DO UPDATE SET ${UPDATE_SET} WHERE ${CHANGED}`,
      )
      .bind(source, item.externalId, item.url, item.title, item.imageUrl, item.publishedAt);
  };

  /** 取得の結果を書く。`last_succeeded_at` は成功のときだけ書き換え、失敗の間は残す（FR-016） */
  const fetchResultStatement = (source: ExternalSource, result: FetchResultInput) =>
    db
      .prepare(
        `INSERT INTO fetch_result (source, fetched_at, is_ok, reason, last_succeeded_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (source) DO UPDATE SET fetched_at = excluded.fetched_at,
           is_ok = excluded.is_ok, reason = excluded.reason,
           last_succeeded_at = coalesce(excluded.last_succeeded_at, fetch_result.last_succeeded_at)`,
      )
      .bind(
        source,
        result.fetchedAt,
        result.isOk ? 1 : 0,
        result.reason,
        result.isOk ? result.fetchedAt : null,
      );

  return {
    listStoredKeys: async (source) => {
      const { results } = await db
        .prepare(
          `SELECT id, external_id, url, published_at FROM activity
           WHERE source = ? AND ${EXTERNAL}`,
        )
        .bind(source)
        .all<Pick<ActivityRow, 'id' | 'external_id' | 'url' | 'published_at'>>();
      return results.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        url: row.url,
        publishedAt: row.published_at,
      }));
    },

    applyFetch: async (source, { items, removeIds, result }) => {
      const upserts = items.map((item) => upsertStatement(source, item));
      const removals = removeIds.map((id) =>
        db
          .prepare(`DELETE FROM activity WHERE id = ? AND source = ? AND ${EXTERNAL}`)
          .bind(id, source),
      );
      const results = await db.batch([
        ...upserts,
        ...removals,
        fetchResultStatement(source, result),
      ]);
      const sum = (from: number, to: number) =>
        results.slice(from, to).reduce((total, r) => total + (r.meta.changes ?? 0), 0);
      return {
        written: sum(0, upserts.length),
        removed: sum(upserts.length, upserts.length + removals.length),
      };
    },

    recordFetchResult: async (source, result) => {
      await fetchResultStatement(source, result).run();
    },

    listFetchResults: async () => {
      const { results } = await db
        .prepare(
          'SELECT source, fetched_at, is_ok, reason, last_succeeded_at FROM fetch_result ORDER BY source',
        )
        .all<FetchResultRow>();
      return results.map((row): FetchResult => ({
        source: row.source,
        fetchedAt: row.fetched_at,
        isOk: row.is_ok === 1,
        reason: row.reason,
        lastSucceededAt: row.last_succeeded_at,
      }));
    },

    list: async () => {
      const { results } = await db
        .prepare(
          `SELECT ${COLUMNS} FROM activity WHERE ${EXTERNAL} ORDER BY published_at DESC, id DESC`,
        )
        .all<ActivityRow>();
      return results.map(toActivity);
    },

    findForEdit: async (id) => {
      const row = await db
        .prepare(`SELECT ${COLUMNS} FROM activity WHERE id = ? AND ${EXTERNAL}`)
        .bind(id)
        .first<ActivityRow>();
      return row ? toActivity(row) : null;
    },

    findIdByUid: async (uid) =>
      (
        await db
          .prepare(`SELECT id FROM activity WHERE uid = ? AND ${EXTERNAL}`)
          .bind(uid)
          .first<{ id: number }>()
      )?.id ?? null,

    register: async (source, item) => {
      try {
        const row = await db
          .prepare(
            `INSERT INTO activity (source, external_id, url, title, image_url, published_at)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id, uid`,
          )
          .bind(source, item.externalId, item.url, item.title, item.imageUrl, item.publishedAt)
          .first<{ id: number; uid: string }>();
        if (!row) throw new Error('activity に行を入れられなかった');
        return { ok: true, id: row.id, uid: row.uid };
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: 'duplicate' };
        throw error;
      }
    },

    edit: async (id, values) => {
      try {
        const result = await db
          .prepare(
            `UPDATE activity SET url = ?, external_id = ?, title = ?, published_at = ?
             WHERE id = ? AND ${EXTERNAL}`,
          )
          .bind(values.url, values.externalId, values.title, values.publishedAt, id)
          .run();
        return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: 'duplicate' };
        throw error;
      }
    },

    delete: async (id) => {
      const result = await db
        .prepare(`DELETE FROM activity WHERE id = ? AND ${EXTERNAL}`)
        .bind(id)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    listRefreshTargets: async (sources, offset, limit) => {
      if (sources.length === 0 || limit <= 0) return [];
      const { results } = await db
        .prepare(
          `SELECT id, source, url FROM activity
           WHERE source IN (${sources.map(() => '?').join(', ')}) ORDER BY id`,
        )
        .bind(...sources)
        .all<{ id: number; source: UrlSource; url: string }>();
      if (results.length === 0) return [];
      // 末尾を過ぎたら先頭に戻る。行が limit より少なければ、すべてを 1 回ずつ返す
      const start = offset % results.length;
      const count = Math.min(limit, results.length);
      return Array.from({ length: count }, (_, i) => results[(start + i) % results.length]);
    },

    applyRefresh: async ({ updates, removeIds, results }) => {
      const statements = [
        ...updates.map((update) =>
          db
            .prepare(
              `UPDATE activity SET title = ?, image_url = ?
               WHERE id = ? AND ${EXTERNAL} AND (title IS NOT ? OR image_url IS NOT ?)`,
            )
            .bind(update.title, update.imageUrl, update.id, update.title, update.imageUrl),
        ),
        ...removeIds.map((id) =>
          db.prepare(`DELETE FROM activity WHERE id = ? AND ${EXTERNAL}`).bind(id),
        ),
        ...results.map(({ source, result }) => fetchResultStatement(source, result)),
      ];
      if (statements.length > 0) await db.batch(statements);
    },
  };
};
