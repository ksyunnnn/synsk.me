import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PERSONAL_ORGANIZATION_ID } from '@/shared/domain/organization';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertOrganization,
  insertPersonalOrganization,
  insertProject,
} from '../support/career-and-project-rows';

/**
 * 組織の編集と削除（specs/001-career-and-project/spec.md の FR-001・FR-003・FR-006・FR-041）。
 * 決まりは SQL の条件でも止めることを、ユースケースを通さずに確かめる。
 */

const organizations = createD1OrganizationRepository(env.DB);

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteCareerAndProjectRows(env.DB);
});

describe('edit', () => {
  it('組織名と秘匿化した組織名を直す', async () => {
    const id = await insertOrganization(env.DB);
    expect(
      await organizations.edit(id, { name: '直した組織名', nameMasked: '直した会社' }),
    ).toEqual({
      ok: true,
    });
    expect(await organizations.findById(id)).toMatchObject({
      name: '直した組織名',
      nameMasked: '直した会社',
    });
  });

  it('ほかの組織と同じ組織名にしない（FR-003）', async () => {
    await insertOrganization(env.DB, { name: 'ある組織' });
    const id = await insertOrganization(env.DB, { name: '別の組織' });
    expect(await organizations.edit(id, { name: 'ある組織', nameMasked: null })).toEqual({
      ok: false,
      reason: 'name-taken',
    });
  });

  it.each([
    ['職歴', insertCareer],
    ['実績', insertProject],
  ] as const)(
    '秘匿化した%sが指す組織の、秘匿化した組織名を空にしない（FR-001）',
    async (_, insert) => {
      const id = await insertOrganization(env.DB);
      await insert(env.DB, { organizationId: id, isMasked: true });
      expect(await organizations.edit(id, { name: '作り物株式会社', nameMasked: null })).toEqual({
        ok: false,
        reason: 'masked-name-required',
      });
      expect((await organizations.findById(id))?.nameMasked).toBe('ある会社');
    },
  );

  it('秘匿化しない実績だけが指す組織は、秘匿化した組織名を空にできる', async () => {
    const id = await insertOrganization(env.DB);
    await insertProject(env.DB, { organizationId: id, isMasked: false });
    expect(await organizations.edit(id, { name: '作り物株式会社', nameMasked: null })).toEqual({
      ok: true,
    });
  });

  it('無い id なら not-found', async () => {
    expect(await organizations.edit(999, { name: 'x', nameMasked: null })).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });
});

describe('findReferences', () => {
  it('職歴・実績が指しているかと、秘匿化した職歴・実績が指しているかを返す', async () => {
    const id = await insertOrganization(env.DB);
    expect(await organizations.findReferences(id)).toEqual({
      isReferenced: false,
      isReferencedByMasked: false,
    });
    await insertProject(env.DB, { organizationId: id, isMasked: false });
    expect(await organizations.findReferences(id)).toEqual({
      isReferenced: true,
      isReferencedByMasked: false,
    });
    await insertCareer(env.DB, { organizationId: id });
    expect(await organizations.findReferences(id)).toEqual({
      isReferenced: true,
      isReferencedByMasked: true,
    });
  });
});

describe('delete', () => {
  it('どこからも指されていない組織を消す', async () => {
    const id = await insertOrganization(env.DB);
    expect(await organizations.delete(id)).toEqual({ ok: true });
    expect(await organizations.findById(id)).toBeNull();
  });

  it.each([
    ['職歴', insertCareer],
    ['実績', insertProject],
  ] as const)('%sが指している組織は消さない（FR-006）', async (_, insert) => {
    const id = await insertOrganization(env.DB);
    await insert(env.DB, { organizationId: id });
    expect(await organizations.delete(id)).toEqual({ ok: false, reason: 'referenced' });
    expect(await organizations.findById(id)).not.toBeNull();
  });

  it('個人の組織は消さない（FR-041）', async () => {
    await insertPersonalOrganization(env.DB);
    expect(await organizations.delete(PERSONAL_ORGANIZATION_ID)).toEqual({
      ok: false,
      reason: 'personal',
    });
    expect(await organizations.findById(PERSONAL_ORGANIZATION_ID)).not.toBeNull();
  });

  it('無い id なら not-found', async () => {
    expect(await organizations.delete(999)).toEqual({ ok: false, reason: 'not-found' });
  });
});
