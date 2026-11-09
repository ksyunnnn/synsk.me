import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createD1LifeEventRepository } from '@/features/activity/server/d1-life-event-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * `LifeEventRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/004-external-activity/spec.md の FR-023・FR-026・FR-027・FR-035、User Story 5 の
 * Acceptance 10）。値はすべて作り物
 */

const lifeEvents = createD1LifeEventRepository(env.DB);

const content = (overrides = {}) => ({
  title: '作り物の出来事',
  description: '作り物の説明\n2 行目',
  happenedOn: '2020-04-01' as CalendarDate,
  slug: 'fake-life-event',
  ...overrides,
});

const register = async (overrides = {}) => {
  const result = await lifeEvents.register(content(overrides));
  if (!result.ok) throw new Error(`life event を登録できなかった: ${result.reason}`);
  return result;
};

/** 外部の activity の作り物の行。life event の文がこの行を読み書きしないことを確かめる */
const insertExternal = () =>
  env.DB.prepare(
    "INSERT INTO activity (source, url, title, published_at) VALUES ('zenn', 'https://zenn.dev/fake', '作り物の記事', '2025-01-01T00:00:00.000Z') RETURNING id, uid",
  ).first<{ id: number; uid: string }>();

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM media WHERE activity_id IS NOT NULL'),
    env.DB.prepare('DELETE FROM activity'),
  ]);
});

describe('register と findForEdit', () => {
  it('life event を保存し、uid と識別子で読み戻せる', async () => {
    const { id, uid } = await register();

    expect(uid).toMatch(/^[0-9a-f]{32}$/);
    expect(await lifeEvents.findIdByUid(uid)).toBe(id);
    expect(await lifeEvents.findForEdit(id)).toEqual({
      id,
      uid,
      slug: 'fake-life-event',
      title: '作り物の出来事',
      description: '作り物の説明\n2 行目',
      happenedOn: '2020-04-01',
    });
  });

  it('識別子がほかの life event と重なれば拒む（FR-035）', async () => {
    await register();

    expect(await lifeEvents.register(content())).toEqual({ ok: false, reason: 'slug-taken' });
  });
});

describe('edit', () => {
  it('識別子を書き換えられ、古い識別子では見つからない（FR-035・SC-007）', async () => {
    const { id } = await register();

    expect(await lifeEvents.edit(id, content({ slug: 'fake-renamed', title: null }))).toEqual({
      ok: true,
    });
    expect(await lifeEvents.hasSlug('fake-life-event')).toBe(false);
    expect(await lifeEvents.findVisitorBySlug('fake-renamed')).toMatchObject({ title: null });
  });

  it('ほかの life event の識別子に書き換えるのを拒む', async () => {
    await register({ slug: 'fake-other' });
    const { id } = await register();

    expect(await lifeEvents.edit(id, content({ slug: 'fake-other' }))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });

  it('外部の activity の id では書き換えない', async () => {
    const external = await insertExternal();

    expect(await lifeEvents.edit(external!.id, content())).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });
});

describe('delete', () => {
  it('消した life event の行が残らない（Acceptance 10）', async () => {
    const { id } = await register();

    expect(await lifeEvents.delete(id)).toEqual({ ok: true });
    const row = await env.DB.prepare('SELECT id FROM activity WHERE id = ?').bind(id).first();
    expect(row).toBeNull();
  });

  it('外部の activity は消さない', async () => {
    const external = await insertExternal();

    expect(await lifeEvents.delete(external!.id)).toEqual({ ok: false });
    expect(await lifeEvents.findIdByUid(external!.uid)).toBeNull();
  });
});

describe('訪問者向け', () => {
  it('DTO の値だけを返す', async () => {
    await register();

    expect(await lifeEvents.findVisitorBySlug('fake-life-event')).toEqual({
      slug: 'fake-life-event',
      title: '作り物の出来事',
      description: '作り物の説明\n2 行目',
      happenedOn: '2020-04-01',
    });
    expect(await lifeEvents.findVisitorBySlug('fake-missing')).toBeNull();
  });

  it('一覧は起きた日の新しい順', async () => {
    await register({ slug: 'fake-old', happenedOn: '2019-01-01' });
    await register({ slug: 'fake-new', happenedOn: '2021-01-01' });
    await insertExternal();

    expect((await lifeEvents.list()).map((row) => row.slug)).toEqual(['fake-new', 'fake-old']);
  });
});
