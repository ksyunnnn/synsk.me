import 'server-only';

import type {
  LifeEvent,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * `LifeEventRepository` の D1 の実装。life event は `activity` の `source = 'life_event'` の行で、
 * どの文もその行だけを読み書きする。行の型はこのファイルの中だけに置く
 */

type LifeEventRow = {
  id: number;
  uid: string;
  slug: string;
  title: string;
  description: string | null;
  happened_on: string;
};

const LIFE_EVENT = "source = 'life_event'";

const isSlugTaken = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: activity.slug');

const toLifeEvent = (row: LifeEventRow): LifeEvent => ({
  id: row.id,
  uid: row.uid,
  slug: row.slug,
  title: row.title,
  description: row.description,
  happenedOn: row.happened_on as CalendarDate,
});

export const createD1LifeEventRepository = (db: D1Database): LifeEventRepository => ({
  findVisitorBySlug: async (slug) => {
    // 訪問者に出す列だけを読む（contracts/visitor-life-event.md）
    const row = await db
      .prepare(
        `SELECT slug, title, happened_on, description FROM activity
         WHERE slug = ? AND ${LIFE_EVENT}`,
      )
      .bind(slug)
      .first<Pick<LifeEventRow, 'slug' | 'title' | 'happened_on' | 'description'>>();
    if (!row) return null;
    const dto: VisitorLifeEvent = {
      slug: row.slug,
      title: row.title,
      happenedOn: row.happened_on as CalendarDate,
      description: row.description,
    };
    return dto;
  },

  hasSlug: async (slug) =>
    (await db
      .prepare(`SELECT 1 AS found FROM activity WHERE slug = ? AND ${LIFE_EVENT}`)
      .bind(slug)
      .first()) !== null,

  findForEdit: async (id) => {
    const row = await db
      .prepare(
        `SELECT id, uid, slug, title, description, happened_on FROM activity
         WHERE id = ? AND ${LIFE_EVENT}`,
      )
      .bind(id)
      .first<LifeEventRow>();
    return row ? toLifeEvent(row) : null;
  },

  findIdByUid: async (uid) =>
    (
      await db
        .prepare(`SELECT id FROM activity WHERE uid = ? AND ${LIFE_EVENT}`)
        .bind(uid)
        .first<{ id: number }>()
    )?.id ?? null,

  list: async () => {
    const { results } = await db
      .prepare(
        `SELECT id, uid, slug, title, description, happened_on FROM activity
         WHERE ${LIFE_EVENT} ORDER BY happened_on DESC, id DESC`,
      )
      .all<LifeEventRow>();
    return results.map((row): LifeEventSummary => ({
      id: row.id,
      uid: row.uid,
      slug: row.slug,
      title: row.title,
      happenedOn: row.happened_on as CalendarDate,
    }));
  },

  register: async (content) => {
    try {
      const row = await db
        .prepare(
          `INSERT INTO activity (source, slug, title, description, happened_on)
           VALUES ('life_event', ?, ?, ?, ?) RETURNING id, uid`,
        )
        .bind(content.slug, content.title, content.description, content.happenedOn)
        .first<{ id: number; uid: string }>();
      if (!row) throw new Error('life event を入れられなかった');
      return { ok: true, id: row.id, uid: row.uid };
    } catch (error) {
      if (isSlugTaken(error)) return { ok: false, reason: 'slug-taken' };
      throw error;
    }
  },

  edit: async (id, content) => {
    try {
      const result = await db
        .prepare(
          `UPDATE activity SET slug = ?, title = ?, description = ?, happened_on = ?
           WHERE id = ? AND ${LIFE_EVENT}`,
        )
        .bind(content.slug, content.title, content.description, content.happenedOn, id)
        .run();
      return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
    } catch (error) {
      if (isSlugTaken(error)) return { ok: false, reason: 'slug-taken' };
      throw error;
    }
  },

  delete: async (id) => {
    // 代表画像のつながりを外し、画像の記録を消してから life event を消す（FR-027）。外部キーは
    // NO ACTION のため、子の行を先に消す。R2 の画像の削除は、画像の仕組み（plan.md の U10）が
    // できてから足す
    const results = await db.batch([
      db
        .prepare(`UPDATE activity SET card_media_id = NULL WHERE id = ? AND ${LIFE_EVENT}`)
        .bind(id),
      db
        .prepare(
          `DELETE FROM media WHERE activity_id = ?
             AND EXISTS (SELECT 1 FROM activity WHERE id = ? AND ${LIFE_EVENT})`,
        )
        .bind(id, id),
      db.prepare(`DELETE FROM activity WHERE id = ? AND ${LIFE_EVENT}`).bind(id),
    ]);
    return { ok: (results.at(-1)?.meta.changes ?? 0) > 0 };
  },
});
