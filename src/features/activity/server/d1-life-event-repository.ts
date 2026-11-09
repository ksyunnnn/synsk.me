import 'server-only';

import type { LifeEvent, VisitorLifeEvent } from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * `LifeEventRepository` の D1 の実装（docs/SOFTWARE_DESIGN.md の Repository）。行の型はこの
 * ファイルの中だけで書く。どの文も `source = 'life_event'` を条件にし、外部の activity の行を
 * 読み書きしない。訪問者向けの取り出しは DTO の列だけを読む（contracts/visitor-life-event.md）
 */

type LifeEventRow = {
  id: number;
  uid: string;
  slug: string;
  title: string | null;
  description: string | null;
  happened_on: string;
};

const IS_LIFE_EVENT = "source = 'life_event'";

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
    const row = await db
      .prepare(
        `SELECT slug, title, description, happened_on FROM activity WHERE ${IS_LIFE_EVENT} AND slug = ?`,
      )
      .bind(slug)
      .first<Omit<LifeEventRow, 'id' | 'uid'>>();
    return row
      ? ({
          slug: row.slug,
          title: row.title,
          description: row.description,
          happenedOn: row.happened_on as CalendarDate,
        } satisfies VisitorLifeEvent)
      : null;
  },

  hasSlug: async (slug) =>
    (await db
      .prepare(`SELECT 1 AS found FROM activity WHERE ${IS_LIFE_EVENT} AND slug = ?`)
      .bind(slug)
      .first()) !== null,

  findForEdit: async (id) => {
    const row = await db
      .prepare(
        `SELECT id, uid, slug, title, description, happened_on FROM activity WHERE ${IS_LIFE_EVENT} AND id = ?`,
      )
      .bind(id)
      .first<LifeEventRow>();
    return row ? toLifeEvent(row) : null;
  },

  findIdByUid: async (uid) => {
    const row = await db
      .prepare(`SELECT id FROM activity WHERE ${IS_LIFE_EVENT} AND uid = ?`)
      .bind(uid)
      .first<{ id: number }>();
    return row?.id ?? null;
  },

  list: async () => {
    const { results } = await db
      .prepare(
        `SELECT id, uid, slug, title, happened_on FROM activity WHERE ${IS_LIFE_EVENT} ORDER BY happened_on DESC, id DESC`,
      )
      .all<Omit<LifeEventRow, 'description'>>();
    // 一覧は説明を使わないので読まない
    return results.map((row) => ({
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
          "INSERT INTO activity (source, slug, title, description, happened_on) VALUES ('life_event', ?, ?, ?, ?) RETURNING id, uid",
        )
        .bind(content.slug, content.title, content.description, content.happenedOn)
        .first<{ id: number; uid: string }>();
      if (!row) throw new Error('life event の行を入れられなかった');
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
          `UPDATE activity SET slug = ?, title = ?, description = ?, happened_on = ? WHERE ${IS_LIFE_EVENT} AND id = ?`,
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
    const result = await db
      .prepare(`DELETE FROM activity WHERE ${IS_LIFE_EVENT} AND id = ?`)
      .bind(id)
      .run();
    return { ok: result.meta.changes > 0 };
  },
});
