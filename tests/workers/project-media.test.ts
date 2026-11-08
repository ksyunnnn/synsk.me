import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createD1CareerRepository } from '@/features/career/server/d1-career-repository';
import { createD1ProjectRepository } from '@/features/project/server/d1-project-repository';
import { IMAGE_MAX_COUNT } from '@/shared/domain/media-image';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertOrganization,
  insertProject,
} from '../support/career-and-project-rows';

/**
 * 実績・職歴の画像の記録と、訪問者に返す条件（specs/001-career-and-project/spec.md の
 * FR-027・FR-028・FR-030、plan.md の U5）
 */

const projects = createD1ProjectRepository(env.DB);
const careers = createD1CareerRepository(env.DB);

const FILE_A = '00000000-0000-4000-8000-0000000000aa.png';
const FILE_B = '00000000-0000-4000-8000-0000000000bb.png';
const KEY_A = `projects/${FILE_A}`;
const KEY_B = `projects/${FILE_B}`;
const SLUG = 'fake-project-with-media';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteCareerAndProjectRows(env.DB);
});

/** 本文が画像 A を指し、画像 B も持つ実績 */
const seed = async ({
  isMasked = false,
  status = 'published',
}: { isMasked?: boolean; status?: 'draft' | 'published' } = {}) => {
  const organizationId = await insertOrganization(env.DB);
  const id = await insertProject(env.DB, {
    organizationId,
    slug: SLUG,
    description: `![](media:${FILE_A})`,
    isMasked,
    status,
  });
  expect(await projects.addImage(id, KEY_A)).toEqual({ ok: true });
  expect(await projects.addImage(id, KEY_B)).toEqual({ ok: true });
  return id;
};

describe('実績の画像を訪問者に返す条件（FR-030）', () => {
  it('サイトに載せる秘匿化しない実績の、本文が指す画像だけを返す', async () => {
    await seed();
    expect(await projects.findVisitorImage(SLUG, KEY_A)).toBe(KEY_A);
    expect(await projects.findVisitorImage(SLUG, KEY_B)).toBeNull();
  });

  it('代表画像に選んだ画像は、本文に無くても返し、訪問者向けの DTO が持つ（FR-028）', async () => {
    const id = await seed();
    expect(await projects.chooseCardImage(id, KEY_B)).toEqual({ ok: true });
    expect(await projects.findVisitorImage(SLUG, KEY_B)).toBe(KEY_B);
    expect(await projects.findVisitorBySlug(SLUG)).toMatchObject({ cardImageFile: FILE_B });
  });

  it('秘匿化した実績の画像は、本文が指していても代表画像でも返さない', async () => {
    const id = await seed({ isMasked: true });
    expect(await projects.chooseCardImage(id, KEY_B)).toEqual({ ok: true });
    expect(await projects.findVisitorImage(SLUG, KEY_A)).toBeNull();
    expect(await projects.findVisitorImage(SLUG, KEY_B)).toBeNull();
  });

  it('サイトに載せない実績の画像は返さない', async () => {
    await seed({ status: 'draft' });
    expect(await projects.findVisitorImage(SLUG, KEY_A)).toBeNull();
  });
});

describe('代表画像を選ぶ（FR-028）', () => {
  it('その実績の画像だけを選べ、ほかの実績の画像は選べない', async () => {
    const id = await seed();
    const other = await insertProject(env.DB, {
      organizationId: await insertOrganization(env.DB, { name: 'ほかの作り物の組織' }),
    });
    const otherKey = 'projects/00000000-0000-4000-8000-0000000000cc.png';
    await projects.addImage(other, otherKey);
    expect(await projects.chooseCardImage(id, otherKey)).toEqual({
      ok: false,
      reason: 'not-own-image',
    });
    expect(await projects.chooseCardImage(999, KEY_A)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('選んだ代表画像は編集の値に出て、null で外せる。画像を足しても更新日時は変えない', async () => {
    const id = await insertProject(env.DB, { organizationId: await insertOrganization(env.DB) });
    const before = await projects.findForEdit(id);
    await projects.addImage(id, KEY_A);
    await projects.addImage(id, KEY_B);
    expect((await projects.findForEdit(id))?.updatedAt).toBe(before?.updatedAt);
    await projects.chooseCardImage(id, KEY_A);
    expect(await projects.findForEdit(id)).toMatchObject({
      images: [FILE_A, FILE_B],
      cardImageFile: FILE_A,
    });
    expect(await projects.chooseCardImage(id, null)).toEqual({ ok: true });
    expect(await projects.findForEdit(id)).toMatchObject({ cardImageFile: null });
  });
});

describe('画像の数と削除（constitution II、research.md の R8）', () => {
  it(`1 つの実績に ${IMAGE_MAX_COUNT} 枚を超えて足さない`, async () => {
    const id = await insertProject(env.DB, { organizationId: await insertOrganization(env.DB) });
    for (let i = 0; i < IMAGE_MAX_COUNT; i++) {
      expect(await projects.addImage(id, `projects/${i}.png`)).toEqual({ ok: true });
    }
    expect(await projects.addImage(id, 'projects/over.png')).toEqual({
      ok: false,
      reason: 'too-many-images',
    });
    expect(await projects.addImage(999, 'projects/none.png')).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('実績を消すと、代表画像に選んだ画像も含めて行を消し、R2 のキーを返す', async () => {
    const id = await seed();
    await projects.chooseCardImage(id, KEY_B);
    const result = await projects.delete(id);
    expect(result.ok && [...result.storageKeys].sort()).toEqual([KEY_A, KEY_B].sort());
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM media').first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it('職歴の画像を足し、職歴を消すと R2 のキーを返す', async () => {
    const id = await insertCareer(env.DB, { organizationId: await insertOrganization(env.DB) });
    const key = `careers/${FILE_A}`;
    expect(await careers.addImage(id, key)).toEqual({ ok: true });
    expect(await careers.findOwnerImage(id, key)).toBe(key);
    expect(await careers.findForEdit(id)).toMatchObject({ images: [FILE_A] });
    expect(await careers.delete(id)).toEqual({ ok: true, storageKeys: [key] });
  });
});
