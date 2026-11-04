import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';
import { PERSONAL_ORGANIZATION_ID } from '@/shared/domain/organization';
import {
  deleteCareerAndProjectRows,
  insertOrganization,
  insertPersonalOrganization,
} from '../support/career-and-project-rows';

/**
 * `OrganizationRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/001-career-and-project/spec.md の FR-001〜FR-003）。
 */

const organizations = createD1OrganizationRepository(env.DB);

const countOrganizations = async () =>
  (await env.DB.prepare('SELECT count(*) AS n FROM organization').first<{ n: number }>())?.n;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteCareerAndProjectRows(env.DB);
});

describe('findOrCreateByName', () => {
  it('無い組織名なら作る', async () => {
    const created = await organizations.findOrCreateByName('作り物株式会社', 'ある会社');
    expect(created).toMatchObject({ name: '作り物株式会社', nameMasked: 'ある会社' });
    expect(await organizations.findById(created.id)).toEqual(created);
  });

  it('同じ組織名で探すと、同じ行を返し、2 つ目を作らない（FR-003）', async () => {
    const first = await organizations.findOrCreateByName('作り物株式会社', 'ある会社');
    const second = await organizations.findOrCreateByName('作り物株式会社', null);
    expect(second).toEqual(first);
    expect(await countOrganizations()).toBe(1);
  });

  it('既にある組織の秘匿化した組織名を変えない', async () => {
    await insertOrganization(env.DB, { name: '作り物株式会社', nameMasked: 'ある会社' });
    const found = await organizations.findOrCreateByName('作り物株式会社', '別の名前');
    expect(found.nameMasked).toBe('ある会社');
  });

  it('秘匿化した組織名を空にして作れる（FR-001）', async () => {
    const created = await organizations.findOrCreateByName('作り物合同会社', null);
    expect(created.nameMasked).toBeNull();
  });
});

describe('findById', () => {
  it('無い id なら null', async () => {
    expect(await organizations.findById(999)).toBeNull();
  });

  it('個人の組織を定数の id で読める', async () => {
    await insertPersonalOrganization(env.DB);
    expect(await organizations.findById(PERSONAL_ORGANIZATION_ID)).toMatchObject({
      id: PERSONAL_ORGANIZATION_ID,
    });
  });
});

describe('listNames', () => {
  it('組織名を名前の順に返す', async () => {
    await insertOrganization(env.DB, { name: 'b 作り物' });
    await insertOrganization(env.DB, { name: 'a 作り物' });
    expect(await organizations.listNames()).toEqual(['a 作り物', 'b 作り物']);
  });
});
