import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectContent } from '@/features/project/domain/project';
import { createD1ProjectRepository } from '@/features/project/server/d1-project-repository';
import type { CalendarDate } from '@/shared/domain/period';
import {
  deleteCareerAndProjectRows,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';

/**
 * `ProjectRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/001-career-and-project/spec.md の FR-011・FR-013・FR-042、research.md の R7・R8）。
 * 訪問者向けの取り出しで隠す列を読まないことは tests/workers/project-masking.test.ts が持つ。
 */

const projects = createD1ProjectRepository(env.DB);

const OPENED_AT = '2026-11-01T00:00:00.000Z';
const NOW = '2026-11-04T00:00:00.000Z';

const content = (overrides: Partial<ProjectContent & { slug: string }> = {}) => ({
  organizationName: '作り物株式会社',
  organizationNameMasked: 'ある会社',
  kind: 'application' as const,
  title: '作り物の受託開発',
  titleMasked: '業務システムの開発',
  isMasked: true,
  status: 'draft' as const,
  period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
  description: '作り物の本文',
  url: 'https://example.com/fake',
  skillIds: [] as number[],
  slug: crypto.randomUUID(),
  ...overrides,
});

const register = async (overrides: Parameters<typeof content>[0] = {}) => {
  const result = await projects.register(content(overrides));
  if (!result.ok) throw new Error(`実績を登録できなかった: ${result.reason}`);
  return result.id;
};

const readProjectRow = (id: number) =>
  env.DB.prepare('SELECT * FROM project WHERE id = ?').bind(id).first();

/** 開いたときの更新日時を決めた値にする。トリガが別の値で上書きしない形で書く */
const setUpdatedAt = (id: number, updatedAt: string) =>
  env.DB.prepare('UPDATE project SET updated_at = ? WHERE id = ?').bind(updatedAt, id).run();

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM resume_project'),
    env.DB.prepare('DELETE FROM resume'),
  ]);
  await deleteCareerAndProjectRows(env.DB);
});

describe('register', () => {
  it('組織が無ければ作り、実績を登録する', async () => {
    const id = await register();
    expect(await projects.findForEdit(id)).toMatchObject({
      title: '作り物の受託開発',
      isMasked: true,
      organization: { name: '作り物株式会社', nameMasked: 'ある会社' },
      period: { startedOn: '2021-04-01', endedOn: null },
    });
  });

  it('同じ組織名の組織を使い、2 つ目を作らない（FR-003）', async () => {
    const orgId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    const id = await register();
    expect((await projects.findForEdit(id))?.organization.id).toBe(orgId);
  });

  it('同じ識別子の実績を登録しない（FR-013）', async () => {
    await register({ slug: 'same-slug' });
    expect(await projects.register(content({ slug: 'same-slug' }))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM project').first<{ n: number }>())?.n,
    ).toBe(1);
  });

  it('秘匿化する実績は、秘匿化した組織名の無い組織を指して登録しない（FR-001）', async () => {
    await insertOrganization(env.DB, { name: '作り物株式会社', nameMasked: null });
    expect(await projects.register(content({ organizationNameMasked: null }))).toEqual({
      ok: false,
      reason: 'masked-name-required',
    });
  });

  it('秘匿化しない実績は、秘匿化した組織名の無い組織を指して登録できる', async () => {
    const id = await register({ isMasked: false, organizationNameMasked: null });
    expect((await projects.findForEdit(id))?.organization.nameMasked).toBeNull();
  });
});

describe('サイトに載せるか（FR-044・FR-043）', () => {
  it('登録した値を持ち、編集で切り替えると訪問者への取り出しが変わる', async () => {
    const id = await register({ slug: 'switch-status', isMasked: false });
    expect(await projects.findForEdit(id)).toMatchObject({ status: 'draft' });
    expect(await projects.hasSlug('switch-status')).toBe(false);

    await setUpdatedAt(id, OPENED_AT);
    expect(
      await projects.edit(
        id,
        content({ slug: 'switch-status', isMasked: false, status: 'published' }),
        {
          openedUpdatedAt: OPENED_AT,
          now: NOW,
        },
      ),
    ).toEqual({ ok: true });
    expect(await projects.findForEdit(id)).toMatchObject({ status: 'published' });
    expect((await projects.list()).find((p) => p.id === id)).toMatchObject({ status: 'published' });
    expect(await projects.hasSlug('switch-status')).toBe(true);
  });
});

describe('edit', () => {
  it('開いたときの更新日時が今と同じなら書き、更新日時を新しい値にする（R7）', async () => {
    const id = await register();
    await setUpdatedAt(id, OPENED_AT);
    expect(
      await projects.edit(id, content({ title: '直した題' }), {
        openedUpdatedAt: OPENED_AT,
        now: NOW,
      }),
    ).toEqual({ ok: true });
    expect(await projects.findForEdit(id)).toMatchObject({ title: '直した題', updatedAt: NOW });
  });

  it('先に書き換えられていたら、何も書かない（FR-042）', async () => {
    const id = await register();
    await setUpdatedAt(id, '2026-11-02T00:00:00.000Z');
    const before = await readProjectRow(id);
    expect(
      await projects.edit(id, content({ title: '後から保存した題' }), {
        openedUpdatedAt: OPENED_AT,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await readProjectRow(id)).toEqual(before);
  });

  it('ほかの実績の識別子には変えない（FR-013）', async () => {
    await register({ slug: 'taken' });
    const id = await register({ isMasked: false, slug: 'mine' });
    await setUpdatedAt(id, OPENED_AT);
    expect(
      await projects.edit(id, content({ isMasked: false, slug: 'taken' }), {
        openedUpdatedAt: OPENED_AT,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'slug-taken' });
    expect((await projects.findForEdit(id))?.slug).toBe('mine');
  });

  it('秘匿化した組織名の無い組織へ、秘匿化したまま移さない（FR-001）', async () => {
    const id = await register();
    await setUpdatedAt(id, OPENED_AT);
    await insertOrganization(env.DB, { name: '名前の無い組織', nameMasked: null });
    expect(
      await projects.edit(
        id,
        content({ organizationName: '名前の無い組織', organizationNameMasked: null }),
        {
          openedUpdatedAt: OPENED_AT,
          now: NOW,
        },
      ),
    ).toEqual({ ok: false, reason: 'masked-name-required' });
    expect((await projects.findForEdit(id))?.organization.name).toBe('作り物株式会社');
  });
});

describe('拒まれた編集はどの表にも書かない（docs/SOFTWARE_DESIGN.md の設計原則 1）', () => {
  const readOrganization = (name: string) =>
    env.DB.prepare('SELECT name, name_masked FROM organization WHERE name = ?').bind(name).first();

  it('先に書き換えられていたら、新しい組織を作らない', async () => {
    const id = await register();
    await setUpdatedAt(id, '2026-11-02T00:00:00.000Z');
    expect(
      await projects.edit(
        id,
        content({ organizationName: '新しい組織', organizationNameMasked: '新しい秘匿名' }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await readOrganization('新しい組織')).toBeNull();
  });

  it('先に書き換えられていたら、既にある組織に秘匿化した組織名を入れない', async () => {
    const id = await register();
    await setUpdatedAt(id, '2026-11-02T00:00:00.000Z');
    await insertOrganization(env.DB, { name: '名前の無い組織', nameMasked: null });
    expect(
      await projects.edit(
        id,
        content({ organizationName: '名前の無い組織', organizationNameMasked: '新しい秘匿名' }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await readOrganization('名前の無い組織')).toEqual({
      name: '名前の無い組織',
      name_masked: null,
    });
  });

  it('秘匿化した組織名が要るとして拒んだら、新しい組織を作らない（FR-001）', async () => {
    const id = await register();
    await setUpdatedAt(id, OPENED_AT);
    expect(
      await projects.edit(
        id,
        content({ organizationName: '新しい組織', organizationNameMasked: null }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'masked-name-required' });
    expect(await readOrganization('新しい組織')).toBeNull();
  });

  it('開いた後に消されていたら not-found を返し、組織を作らない', async () => {
    const id = await register();
    await projects.delete(id);
    expect(
      await projects.edit(
        id,
        content({ organizationName: '新しい組織', organizationNameMasked: '新しい秘匿名' }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'not-found' });
    expect(await readOrganization('新しい組織')).toBeNull();
  });
});

describe('delete', () => {
  it('写した職務経歴書の行を残し、指す id を空にしてから消す（R8）', async () => {
    const id = await register();
    const skillId = await insertSkill(env.DB);
    await linkProjectSkill(env.DB, id, skillId);
    const resume = await env.DB.prepare(
      "INSERT INTO resume (slug, title) VALUES ('fake-resume', '作り物の職務経歴書') RETURNING id",
    ).first<{ id: number }>();
    await env.DB.prepare(
      `INSERT INTO resume_project (resume_id, project_id, organization_name, kind, title, started_on)
       VALUES (?, ?, '写した組織名', 'application', '写した題', '2021-04-01')`,
    )
      .bind(resume?.id, id)
      .run();

    expect(await projects.delete(id)).toEqual({ ok: true });
    expect(await projects.findForEdit(id)).toBeNull();
    expect(await env.DB.prepare('SELECT project_id, title FROM resume_project').first()).toEqual({
      project_id: null,
      title: '写した題',
    });
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM project_skill').first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it('無い id なら ok: false', async () => {
    expect(await projects.delete(999)).toEqual({ ok: false });
  });
});

describe('一覧と有無', () => {
  it('始まりの日の新しい順に並べる', async () => {
    const orgId = await insertOrganization(env.DB);
    await insertProject(env.DB, { organizationId: orgId, title: '古い', startedOn: '2019-01-01' });
    await insertProject(env.DB, {
      organizationId: orgId,
      title: '新しい',
      startedOn: '2024-01-01',
    });
    expect((await projects.list()).map((p) => p.title)).toEqual(['新しい', '古い']);
  });

  it('識別子と id の有無を返す', async () => {
    const id = await register({ slug: 'exists', status: 'published' });
    expect(await projects.hasSlug('exists')).toBe(true);
    expect(await projects.hasSlug('absent')).toBe(false);
    expect(await projects.hasId(id)).toBe(true);
    expect(await projects.hasId(id + 1)).toBe(false);
  });
});

describe('uid（管理画面の URL とフォームの識別子）', () => {
  it('登録は DB が入れた 32 文字の 16 進の uid を返し、編集と一覧の行も同じ uid を持つ', async () => {
    const result = await projects.register(content());
    if (!result.ok) throw new Error(`実績を登録できなかった: ${result.reason}`);
    expect(result.uid).toMatch(/^[0-9a-f]{32}$/);
    expect((await projects.findForEdit(result.id))?.uid).toBe(result.uid);
    expect((await projects.list()).map((p) => p.uid)).toEqual([result.uid]);
  });

  it('uid から id を引く。無い uid なら null', async () => {
    const result = await projects.register(content());
    if (!result.ok) throw new Error(`実績を登録できなかった: ${result.reason}`);
    expect(await projects.findIdByUid(result.uid)).toBe(result.id);
    expect(await projects.findIdByUid('0'.repeat(32))).toBeNull();
  });
});
