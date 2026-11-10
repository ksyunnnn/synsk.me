import 'server-only';

import {
  lifeEventImagePath,
  type LifeEvent,
  type VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * `LifeEventRepository` の D1 の実装（docs/SOFTWARE_DESIGN.md の Repository）。行の型はこの
 * ファイルの中だけで書く。どの文も `source = 'life_event'` を条件にし、外部の activity の行を
 * 読み書きしない。訪問者向けの取り出しは DTO の列だけを読む（contracts/visitor-life-event.md）。
 * 画像の行（`media.activity_id`）は 1 つの life event に 1 行まで（research.md の R12）
 */

type LifeEventRow = {
  id: number;
  uid: string;
  slug: string;
  /** life event の行では空でない（migrations/0021 の CHECK）。FR-024 */
  title: string;
  description: string | null;
  happened_on: string;
  /** 代表画像の置き場のキー（`media.storage_key`）。無ければ null */
  card_storage_key: string | null;
};

const IS_LIFE_EVENT = "a.source = 'life_event'";

/** life event の列と、代表画像の置き場のキー */
const SELECT_LIFE_EVENT = `SELECT a.id, a.uid, a.slug, a.title, a.description, a.happened_on,
  m.storage_key AS card_storage_key
  FROM activity a LEFT JOIN media m ON m.id = a.card_media_id AND m.activity_id = a.id`;

const isSlugTaken = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: activity.slug');

const cardImageUrlOf = (row: Pick<LifeEventRow, 'slug' | 'card_storage_key'>) =>
  row.card_storage_key === null ? null : lifeEventImagePath(row.slug, row.card_storage_key);

const toLifeEvent = (row: LifeEventRow): LifeEvent => ({
  id: row.id,
  uid: row.uid,
  slug: row.slug,
  title: row.title,
  description: row.description,
  happenedOn: row.happened_on as CalendarDate,
  cardImageUrl: cardImageUrlOf(row),
});

export const createD1LifeEventRepository = (db: D1Database): LifeEventRepository => {
  /**
   * その life event の画像の行を消し、消した行の置き場のキーを返す文。消す行とキーを同じ文で
   * 決めるので、並んで走った登録の行を消しても、そのキーを取りこぼさない
   */
  const deleteMedia = (id: number, keep: string | null = null) =>
    db
      .prepare(
        `DELETE FROM media WHERE activity_id = ?1
         AND activity_id IN (SELECT id FROM activity WHERE source = 'life_event')
         AND (?2 IS NULL OR storage_key <> ?2)
         RETURNING storage_key`,
      )
      .bind(id, keep);

  const keysOf = (result: D1Result | undefined): string[] =>
    ((result?.results ?? []) as { storage_key: string }[]).map((row) => row.storage_key);

  return {
    findVisitorBySlug: async (slug) => {
      const row = await db
        .prepare(
          `SELECT a.slug, a.title, a.description, a.happened_on, m.storage_key AS card_storage_key
           FROM activity a LEFT JOIN media m ON m.id = a.card_media_id AND m.activity_id = a.id
           WHERE ${IS_LIFE_EVENT} AND a.slug = ?`,
        )
        .bind(slug)
        .first<Omit<LifeEventRow, 'id' | 'uid'>>();
      return row
        ? ({
            slug: row.slug,
            title: row.title,
            description: row.description,
            happenedOn: row.happened_on as CalendarDate,
            cardImageUrl: cardImageUrlOf(row),
          } satisfies VisitorLifeEvent)
        : null;
    },

    hasSlug: async (slug) =>
      (await db
        .prepare(`SELECT 1 AS found FROM activity a WHERE ${IS_LIFE_EVENT} AND a.slug = ?`)
        .bind(slug)
        .first()) !== null,

    findForEdit: async (id) => {
      const row = await db
        .prepare(`${SELECT_LIFE_EVENT} WHERE ${IS_LIFE_EVENT} AND a.id = ?`)
        .bind(id)
        .first<LifeEventRow>();
      return row ? toLifeEvent(row) : null;
    },

    findIdByUid: async (uid) => {
      const row = await db
        .prepare(`SELECT a.id FROM activity a WHERE ${IS_LIFE_EVENT} AND a.uid = ?`)
        .bind(uid)
        .first<{ id: number }>();
      return row?.id ?? null;
    },

    list: async () => {
      // 一覧は説明と代表画像を使わないので読まない
      const { results } = await db
        .prepare(
          `SELECT a.id, a.uid, a.slug, a.title, a.happened_on FROM activity a WHERE ${IS_LIFE_EVENT} ORDER BY a.happened_on DESC, a.id DESC`,
        )
        .all<Pick<LifeEventRow, 'id' | 'uid' | 'slug' | 'title' | 'happened_on'>>();
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
            "UPDATE activity SET slug = ?, title = ?, description = ?, happened_on = ? WHERE source = 'life_event' AND id = ?",
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
      // media.activity_id の外部キーは送らずに確かめるため、media の行を先に消す（data-model.md）
      const [media, activity] = await db.batch([
        deleteMedia(id),
        db.prepare("DELETE FROM activity WHERE source = 'life_event' AND id = ?").bind(id),
      ]);
      return (activity?.meta.changes ?? 0) > 0
        ? { ok: true, removedKeys: keysOf(media) }
        : { ok: false };
    },

    replaceCardImage: async (id, storageKey, size) => {
      const [inserted, , removed] = await db.batch([
        db
          .prepare(
            "INSERT INTO media (activity_id, storage_key, size) SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM activity WHERE source = 'life_event' AND id = ?1)",
          )
          .bind(id, storageKey, size),
        db
          .prepare(
            "UPDATE activity SET card_media_id = (SELECT id FROM media WHERE storage_key = ?) WHERE source = 'life_event' AND id = ?",
          )
          .bind(storageKey, id),
        deleteMedia(id, storageKey),
      ]);
      return (inserted?.meta.changes ?? 0) > 0
        ? { ok: true, removedKeys: keysOf(removed) }
        : { ok: false };
    },

    removeCardImage: async (id) => {
      const [updated, removed] = await db.batch([
        db
          .prepare(
            "UPDATE activity SET card_media_id = NULL WHERE source = 'life_event' AND id = ?",
          )
          .bind(id),
        deleteMedia(id),
      ]);
      return (updated?.meta.changes ?? 0) > 0
        ? { ok: true, removedKeys: keysOf(removed) }
        : { ok: false };
    },

    isCardImage: async (slug, storageKey) =>
      (await db
        .prepare(
          `SELECT 1 AS found FROM activity a JOIN media m ON m.id = a.card_media_id AND m.activity_id = a.id
           WHERE ${IS_LIFE_EVENT} AND a.slug = ? AND m.storage_key = ?`,
        )
        .bind(slug, storageKey)
        .first()) !== null,
  };
};
