import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createD1ProjectRepository } from '@/features/project/server/d1-project-repository';
import {
  deleteCareerAndProjectRows,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';

/**
 * 訪問者向けの実績の取り出しが、秘匿化した実績で隠す値を返さないこと（specs/001-career-and-project/
 * spec.md の FR-015・FR-026、contracts/visitor-project.md）。
 */

const projects = createD1ProjectRepository(env.DB);

const REAL = {
  organization: '作り物株式会社',
  title: '作り物の受託開発',
  description: '作り物の本文',
  url: 'https://example.com/fake',
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteCareerAndProjectRows(env.DB);
});

const seed = async (isMasked: boolean | undefined) => {
  const organizationId = await insertOrganization(env.DB, {
    name: REAL.organization,
    nameMasked: 'ある会社',
  });
  const id = await insertProject(env.DB, {
    organizationId,
    slug: 'the-project',
    title: REAL.title,
    titleMasked: '業務システムの開発',
    description: REAL.description,
    url: REAL.url,
    startedOn: '2021-04-01',
    endedOn: '2022-03-31',
    isMasked,
  });
  await linkProjectSkill(env.DB, id, await insertSkill(env.DB, { name: 'TypeScript' }));
};

describe('秘匿化した実績', () => {
  it('出してよい値だけを返す（FR-026）', async () => {
    await seed(true);
    expect(await projects.findVisitorBySlug('the-project')).toEqual({
      isMasked: true,
      slug: 'the-project',
      kind: 'application',
      title: '業務システムの開発',
      organizationName: 'ある会社',
      period: { startedOn: '2021-04-01', endedOn: '2022-03-31' },
      skills: ['TypeScript'],
    });
  });

  it('返した値のどこにも、実際の組織名・題・本文・関連 URL が無い', async () => {
    await seed(true);
    const text = JSON.stringify(await projects.findVisitorBySlug('the-project'));
    for (const value of Object.values(REAL)) expect(text).not.toContain(value);
  });

  it('秘匿化を指定せずに入れた実績は、秘匿化した実績として返す（FR-015）', async () => {
    await seed(undefined);
    expect(await projects.findVisitorBySlug('the-project')).toMatchObject({
      isMasked: true,
      title: '業務システムの開発',
    });
  });
});

describe('秘匿化しない実績', () => {
  it('実際の値を返す（FR-023）', async () => {
    await seed(false);
    expect(await projects.findVisitorBySlug('the-project')).toEqual({
      isMasked: false,
      slug: 'the-project',
      kind: 'application',
      title: REAL.title,
      organizationName: REAL.organization,
      period: { startedOn: '2021-04-01', endedOn: '2022-03-31' },
      skills: ['TypeScript'],
      body: REAL.description,
      url: REAL.url,
    });
  });
});

it('無い識別子なら null', async () => {
  expect(await projects.findVisitorBySlug('absent')).toBeNull();
});
