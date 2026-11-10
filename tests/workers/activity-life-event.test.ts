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
      cardImageUrl: null,
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

    expect(
      await lifeEvents.edit(
        id,
        content({ slug: 'fake-renamed', title: '書き換えた作り物の出来事' }),
      ),
    ).toEqual({
      ok: true,
    });
    expect(await lifeEvents.hasSlug('fake-life-event')).toBe(false);
    expect(await lifeEvents.findVisitorBySlug('fake-renamed')).toMatchObject({
      title: '書き換えた作り物の出来事',
    });
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

    expect(await lifeEvents.delete(id)).toEqual({ ok: true, removedKeys: [] });
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
      cardImageUrl: null,
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

/**
 * 代表画像（FR-027〜FR-030、User Story 5 の Acceptance 4〜6、research.md の R12）。置き場のキーは
 * 作り物の UUID。R2 のものの置き方と消し方は共有担当の media-storage が持つ
 */
describe('代表画像', () => {
  const KEY_1 = '11111111-1111-4111-8111-111111111111';
  const KEY_2 = '22222222-2222-4222-8222-222222222222';
  const KEY_OTHER = '33333333-3333-4333-8333-333333333333';

  const mediaKeysOf = async (id: number) =>
    (
      await env.DB.prepare('SELECT storage_key FROM media WHERE activity_id = ? ORDER BY id')
        .bind(id)
        .all<{ storage_key: string }>()
    ).results.map((row) => row.storage_key);

  it('登録すると代表画像になり、訪問者向けの DTO に配る経路の URL が入る', async () => {
    const { id } = await register();

    expect(await lifeEvents.replaceCardImage(id, KEY_1, 64)).toEqual({ ok: true, removedKeys: [] });
    expect((await lifeEvents.findVisitorBySlug('fake-life-event'))?.cardImageUrl).toBe(
      `/life-events/fake-life-event/media/${KEY_1}`,
    );
    expect((await lifeEvents.findForEdit(id))?.cardImageUrl).toBe(
      `/life-events/fake-life-event/media/${KEY_1}`,
    );
  });

  it('新しく登録すると前の画像の行を消し、そのキーを返す。画像は 1 枚まで', async () => {
    const { id } = await register();
    await lifeEvents.replaceCardImage(id, KEY_1, 64);

    expect(await lifeEvents.replaceCardImage(id, KEY_2, 64)).toEqual({
      ok: true,
      removedKeys: [KEY_1],
    });
    expect(await mediaKeysOf(id)).toEqual([KEY_2]);
  });

  it('その life event の代表画像だけを、その識別子の画像として認める（FR-029）', async () => {
    const { id } = await register();
    const other = await register({ slug: 'fake-other' });
    await lifeEvents.replaceCardImage(id, KEY_1, 64);
    await lifeEvents.replaceCardImage(other.id, KEY_OTHER, 64);

    expect(await lifeEvents.isCardImage('fake-life-event', KEY_1)).toBe(true);
    expect(await lifeEvents.isCardImage('fake-life-event', KEY_OTHER)).toBe(false);
    expect(await lifeEvents.isCardImage('fake-missing', KEY_1)).toBe(false);
  });

  it('外すと画像の行を消し、DTO の URL が空になる', async () => {
    const { id } = await register();
    await lifeEvents.replaceCardImage(id, KEY_1, 64);

    expect(await lifeEvents.removeCardImage(id)).toEqual({ ok: true, removedKeys: [KEY_1] });
    expect(await mediaKeysOf(id)).toEqual([]);
    expect((await lifeEvents.findVisitorBySlug('fake-life-event'))?.cardImageUrl).toBeNull();
  });

  it('life event を消すと、画像の行も残らず、そのキーを返す（FR-027・SC-006、Acceptance 6）', async () => {
    const { id } = await register();
    await lifeEvents.replaceCardImage(id, KEY_1, 64);

    expect(await lifeEvents.delete(id)).toEqual({ ok: true, removedKeys: [KEY_1] });
    expect(await mediaKeysOf(id)).toEqual([]);
  });

  it('無い life event や外部の activity には画像を登録しない', async () => {
    const external = await insertExternal();

    expect(await lifeEvents.replaceCardImage(external!.id, KEY_1, 64)).toEqual({ ok: false });
    expect(await lifeEvents.replaceCardImage(999_999, KEY_1, 64)).toEqual({ ok: false });
    const count = await env.DB.prepare('SELECT count(*) AS n FROM media').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
