import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LifeEventContent } from '@/features/activity/domain/life-event';
import { createD1LifeEventRepository } from '@/features/activity/server/d1-life-event-repository';
import type { CalendarDate } from '@/shared/domain/period';
import {
  deleteActivityRows,
  insertExternalActivity,
  insertLifeEvent,
  insertLifeEventCardMedia,
} from '../support/activity-rows';

/**
 * life event の D1 の実装（specs/004-external-activity/spec.md の FR-023〜FR-027・FR-034・
 * FR-035・SC-006）。値はすべて作り物
 */

const lifeEvents = createD1LifeEventRepository(env.DB);

const content: LifeEventContent = {
  title: '作り物の出来事',
  description: '作り物の説明',
  happenedOn: '2020-04-01' as CalendarDate,
};

const count = async (sql: string, ...values: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...values)
      .first<{ n: number }>()
  )?.n ?? 0;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteActivityRows(env.DB);
});

describe('作成・書き換え', () => {
  it('作った life event を、管理画面と訪問者の識別子で読める（User Story 5 の 1・9）', async () => {
    const result = await lifeEvents.register({ ...content, slug: 'fake-event' });
    if (!result.ok) throw new Error(result.reason);
    expect(await lifeEvents.findIdByUid(result.uid)).toBe(result.id);
    expect(await lifeEvents.findForEdit(result.id)).toEqual({
      id: result.id,
      uid: result.uid,
      slug: 'fake-event',
      ...content,
    });
    expect(await lifeEvents.findVisitorBySlug('fake-event')).toEqual({
      slug: 'fake-event',
      title: content.title,
      happenedOn: content.happenedOn,
      description: content.description,
    });
    expect(await lifeEvents.hasSlug('fake-event')).toBe(true);
  });

  it('ほかの life event と重なる識別子を拒む（User Story 5 の 10）', async () => {
    await insertLifeEvent(env.DB, { slug: 'taken' });
    const other = await insertLifeEvent(env.DB, { slug: 'other' });
    expect(await lifeEvents.edit(other, { ...content, slug: 'taken' })).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect(await lifeEvents.register({ ...content, slug: 'taken' })).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });

  it('外部の activity は個別のページの識別子として読めない（FR-034）', async () => {
    const id = await insertExternalActivity(env.DB);
    expect(await lifeEvents.findForEdit(id)).toBeNull();
    expect(await lifeEvents.hasSlug('anything')).toBe(false);
  });
});

describe('削除（FR-027・SC-006）', () => {
  it('life event と、その life event の画像の記録が残らない（User Story 5 の 6）', async () => {
    const id = await insertLifeEvent(env.DB);
    await insertLifeEventCardMedia(env.DB, id);
    const keep = await insertLifeEvent(env.DB);
    await insertLifeEventCardMedia(env.DB, keep);

    expect(await lifeEvents.delete(id)).toEqual({ ok: true });
    expect(await count('SELECT count(*) AS n FROM activity WHERE id = ?', id)).toBe(0);
    expect(await count('SELECT count(*) AS n FROM media WHERE activity_id = ?', id)).toBe(0);
    // ほかの life event の画像は残る
    expect(await count('SELECT count(*) AS n FROM media WHERE activity_id = ?', keep)).toBe(1);
  });

  it('外部の activity の id では消さない', async () => {
    const id = await insertExternalActivity(env.DB);
    expect(await lifeEvents.delete(id)).toEqual({ ok: false });
    expect(await count('SELECT count(*) AS n FROM activity WHERE id = ?', id)).toBe(1);
  });
});
