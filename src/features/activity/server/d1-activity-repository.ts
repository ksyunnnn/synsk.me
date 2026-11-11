import 'server-only';

import type {
  ActivityRepository,
  ExternalActivityRepository,
  ItemChanges,
  StoredItem,
} from '@/features/activity/domain/activity-repository';
import { toPublishedOn, type ExternalActivity } from '@/features/activity/domain/external-activity';
import {
  isOwnedSourceName,
  OWNED_SOURCES,
  type OwnedSourceName,
} from '@/features/activity/domain/sources';

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
  gone_checked_at: string | null;
  consecutive_gone_count: number;
};

/** `ItemChanges` の項目と列の名前 */
const COLUMNS = {
  url: 'url',
  title: 'title',
  publishedAt: 'published_at',
  imageUrl: 'image_url',
} as const satisfies Record<keyof ItemChanges, string>;

const UPSERT_FETCH_RESULT =
  'INSERT INTO fetch_result (source, fetched_at, is_ok, reason, last_succeeded_at, etag, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
  'ON CONFLICT (source) DO UPDATE SET fetched_at = excluded.fetched_at, is_ok = excluded.is_ok, ' +
  'reason = excluded.reason, last_succeeded_at = coalesce(excluded.last_succeeded_at, fetch_result.last_succeeded_at), ' +
  'etag = excluded.etag, last_modified = excluded.last_modified';

export const createD1ActivityRepository = (db: D1Database): ActivityRepository => ({
  listStoredForRefresh: async (source) => {
    const { results } = await db
      .prepare(
        "SELECT id, external_id, url, title, published_at, image_url, gone_checked_at, consecutive_gone_count FROM activity WHERE source = ? AND source <> 'life_event' ORDER BY id",
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
      goneCheckedAt: row.gone_checked_at,
      goneStreak: row.consecutive_gone_count,
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
    const deletes = plan.deletes.map((id) =>
      db
        .prepare("DELETE FROM activity WHERE id = ? AND source = ? AND source <> 'life_event'")
        .bind(id, source),
    );
    // 確かめた日時は確かめる順を決めるためだけの値で、消えた印ではない（research.md の R6）。
    // 404 が続いた回数（StoredItem の goneStreak）は consecutive_gone_count に持ち、取得の回をまたいで
    // 数える。どちらの列だけを書く UPDATE も updated_at を進めない（migrations/0015・0019 のトリガ）
    const goneChecked = (plan.goneChecked ?? []).map(({ id, goneStreak }) =>
      db
        .prepare(
          "UPDATE activity SET gone_checked_at = ?, consecutive_gone_count = ? WHERE id = ? AND source = ? AND source <> 'life_event'",
        )
        .bind(result.fetchedAt, goneStreak, id, source),
    );
    const goneResets = (plan.goneResets ?? []).map((id) =>
      db
        .prepare(
          "UPDATE activity SET consecutive_gone_count = 0 WHERE id = ? AND source = ? AND source <> 'life_event'",
        )
        .bind(id, source),
    );
    await db.batch([
      ...inserts,
      ...updates,
      ...deletes,
      ...goneChecked,
      ...goneResets,
      db
        .prepare(UPSERT_FETCH_RESULT)
        .bind(
          source,
          result.fetchedAt,
          1,
          result.reason,
          result.fetchedAt,
          result.validators?.etag ?? null,
          result.validators?.lastModified ?? null,
        ),
    ]);
  },

  // 条件に使う値は残す。前の値は書き終えた回の中身に対応するので、次の要求に付けても、変わって
  // いれば取得元が中身を返す（research.md の R9）。取り直しの前に順番を取る書き込み（T040）も
  // これを使うので、消すと条件付きの要求が一度も送られない
  recordFetchFailure: async (source, fetchedAt, reason) => {
    await db
      .prepare(
        'INSERT INTO fetch_result (source, fetched_at, is_ok, reason) VALUES (?, ?, 0, ?) ' +
          'ON CONFLICT (source) DO UPDATE SET fetched_at = excluded.fetched_at, is_ok = 0, reason = excluded.reason',
      )
      .bind(source, fetchedAt, reason)
      .run();
  },

  readValidators: async (source) => {
    const row = await db
      .prepare('SELECT etag, last_modified FROM fetch_result WHERE source = ?')
      .bind(source)
      .first<{ etag: string | null; last_modified: string | null }>();
    return row && (row.etag !== null || row.last_modified !== null)
      ? { etag: row.etag, lastModified: row.last_modified }
      : null;
  },

  recordNotModified: async (source, fetchedAt) => {
    await db
      .prepare(
        'UPDATE fetch_result SET fetched_at = ?, is_ok = 1, reason = NULL, last_succeeded_at = ? WHERE source = ?',
      )
      .bind(fetchedAt, fetchedAt, source)
      .run();
  },

  listFetchedAt: async () => {
    const { results } = await db
      .prepare('SELECT source, fetched_at FROM fetch_result')
      .all<{ source: string; fetched_at: string }>();
    return Object.fromEntries(results.map((row) => [row.source, row.fetched_at]));
  },
});

type ExternalActivityRow = {
  id: number;
  uid: string;
  source: OwnedSourceName;
  url: string;
  title: string;
  published_at: string;
};

/** URL を指名する・手で入力する取得元の行だけを指す条件。値は取得元の表の定数（FR-022） */
const IS_OWNED = `source IN (${OWNED_SOURCES.map((name) => `'${name}'`).join(', ')}) AND source <> 'life_event'`;

const isUrlTaken = (error: unknown) =>
  error instanceof Error &&
  error.message.includes('UNIQUE constraint failed: activity.source, activity.url');

const toExternalActivity = (row: ExternalActivityRow): ExternalActivity => ({
  id: row.id,
  uid: row.uid,
  source: row.source,
  url: row.url,
  title: row.title,
  publishedOn: toPublishedOn(row.published_at),
});

const SELECT_EXTERNAL = 'SELECT id, uid, source, url, title, published_at FROM activity';

/**
 * `ExternalActivityRepository` の D1 の実装。どの文も `IS_OWNED` を条件にし、一覧を取る取得元の
 * 行と life event の行を読み書きしない（FR-022・FR-031・FR-033）
 */
export const createD1ExternalActivityRepository = (db: D1Database): ExternalActivityRepository => ({
  list: async () => {
    const { results } = await db
      .prepare(`${SELECT_EXTERNAL} WHERE ${IS_OWNED} ORDER BY published_at DESC, id DESC`)
      .all<ExternalActivityRow>();
    return results.map(toExternalActivity);
  },

  findIdByUid: async (uid) => {
    const row = await db
      .prepare(`SELECT id FROM activity WHERE ${IS_OWNED} AND uid = ?`)
      .bind(uid)
      .first<{ id: number }>();
    return row?.id ?? null;
  },

  findForEdit: async (id) => {
    const row = await db
      .prepare(`${SELECT_EXTERNAL} WHERE ${IS_OWNED} AND id = ?`)
      .bind(id)
      .first<ExternalActivityRow>();
    return row ? toExternalActivity(row) : null;
  },

  register: async (source, content) => {
    if (!isOwnedSourceName(source)) throw new Error(`管理画面で登録する取得元でない: ${source}`);
    try {
      const row = await db
        .prepare(
          'INSERT INTO activity (source, url, title, published_at, image_url) VALUES (?, ?, ?, ?, ?) RETURNING id, uid',
        )
        .bind(source, content.url, content.title, content.publishedAt, content.imageUrl)
        .first<{ id: number; uid: string }>();
      if (!row) throw new Error('外部の activity の行を入れられなかった');
      return { ok: true, id: row.id, uid: row.uid };
    } catch (error) {
      if (isUrlTaken(error)) return { ok: false, reason: 'url-taken' };
      throw error;
    }
  },

  edit: async (id, changes) => {
    const entries = (['url', 'title', 'publishedAt'] as const)
      .filter((key) => changes[key] !== undefined)
      .map((key) => [COLUMNS[key], changes[key]] as const);
    try {
      const result = await db
        .prepare(
          `UPDATE activity SET ${entries.map(([column]) => `${column} = ?`).join(', ')} WHERE ${IS_OWNED} AND id = ?`,
        )
        .bind(...entries.map(([, value]) => value), id)
        .run();
      return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
    } catch (error) {
      if (isUrlTaken(error)) return { ok: false, reason: 'url-taken' };
      throw error;
    }
  },

  delete: async (id) => {
    const result = await db
      .prepare(`DELETE FROM activity WHERE ${IS_OWNED} AND id = ?`)
      .bind(id)
      .run();
    return result.meta.changes > 0;
  },
});
