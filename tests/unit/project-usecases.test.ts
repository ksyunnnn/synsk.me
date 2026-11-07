import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDeps } from '@/features/project/application/deps';
import { deleteProject } from '@/features/project/application/delete-project';
import { editProject } from '@/features/project/application/edit-project';
import { registerProject } from '@/features/project/application/register-project';
import {
  isProjectSlug,
  toProjectFormValues,
  type Project,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { Author } from '@/shared/domain/author';
import type { Organization } from '@/shared/domain/organization';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 実績のユースケース（FR-011・FR-013・FR-040・FR-042）。Repository は作り物の実装を渡す
 * （docs/SOFTWARE_DESIGN.md の Dependency Injection）。D1 の上での動きは
 * tests/workers/project-repository.test.ts が持つ。
 */

const OWNER: Author = { email: 'owner@synsk.test' };
const OPENED_AT = '2026-11-01T00:00:00.000Z';
const NOW = '2026-11-04T00:00:00.000Z';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  slug: '0b6f3c1e-1111-4222-8333-444455556666',
  organization: { id: 1, name: '作り物株式会社', nameMasked: 'ある会社' },
  kind: 'application',
  title: '作り物の受託開発',
  titleMasked: '業務システムの開発',
  isMasked: true,
  status: 'draft',
  period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
  description: null,
  url: null,
  skillIds: [],
  updatedAt: OPENED_AT,
  ...overrides,
});

const values = (overrides: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  ...toProjectFormValues(project()),
  ...overrides,
});

const fakeProjects = (current: Project | null) =>
  ({
    findVisitorBySlug: vi.fn(),
    findForEdit: vi.fn(async () => current),
    list: vi.fn(),
    register: vi.fn(async () => ({ ok: true as const, id: 7 })),
    edit: vi.fn(async () => ({ ok: true as const })),
    delete: vi.fn(async () => ({ ok: true })),
    hasSlug: vi.fn(),
    hasId: vi.fn(),
    listSkillOptions: vi.fn(async () => []),
  }) satisfies ProjectRepository;

let projects: ReturnType<typeof fakeProjects>;
let organization: Organization | null;
let deps: ProjectDeps;

beforeEach(() => {
  projects = fakeProjects(project());
  organization = { id: 1, name: '作り物株式会社', nameMasked: 'ある会社', updatedAt: OPENED_AT };
  deps = { projects, organizations: { findByName: vi.fn(async () => organization) } };
});

describe('作り手でない呼び出しを拒む（FR-040）', () => {
  it('登録は何も書かず、入力した値を返さない', async () => {
    expect(await registerProject(deps, null, values())).toEqual({ status: 'forbidden' });
    expect(projects.register).not.toHaveBeenCalled();
  });

  it('編集は読まずに、何も書かない', async () => {
    expect(
      await editProject(deps, null, 1, values(), { openedUpdatedAt: OPENED_AT, now: NOW }),
    ).toEqual({
      status: 'forbidden',
    });
    expect(projects.findForEdit).not.toHaveBeenCalled();
    expect(projects.edit).not.toHaveBeenCalled();
  });

  it('削除は何も書かない', async () => {
    expect(await deleteProject(projects, null, 1)).toEqual({ status: 'forbidden' });
    expect(projects.delete).not.toHaveBeenCalled();
  });
});

describe('registerProject', () => {
  it('uid の識別子で登録する（FR-013）', async () => {
    expect(await registerProject(deps, OWNER, values({ slug: 'ignored' }))).toEqual({
      status: 'registered',
      id: 7,
    });
    const [saved] = projects.register.mock.calls[0] as unknown as [{ slug: string }];
    expect(saved.slug).not.toBe('ignored');
    expect(isProjectSlug(saved.slug)).toBe(true);
  });

  it('秘匿化するかを送らなければ、秘匿化して登録する（FR-015）', async () => {
    await registerProject(deps, OWNER, values({ isMasked: '' }));
    expect(projects.register).toHaveBeenCalledWith(expect.objectContaining({ isMasked: true }));
  });

  it('項目の不備は、書かずに項目ごとの理由と送られた値を返す', async () => {
    const sent = values({ title: '' });
    expect(await registerProject(deps, OWNER, sent)).toEqual({
      status: 'invalid',
      errors: { title: 'missing' },
      values: sent,
    });
    expect(projects.register).not.toHaveBeenCalled();
  });

  it('識別子が重なれば、識別子の誤りを返す', async () => {
    projects.register.mockResolvedValue({ ok: false, reason: 'slug-taken' } as never);
    expect(await registerProject(deps, OWNER, values())).toMatchObject({
      status: 'invalid',
      errors: { slug: 'slug-taken' },
    });
  });
});

describe('editProject', () => {
  const times = { openedUpdatedAt: OPENED_AT, now: NOW };

  it('開いたときの更新日時と新しい更新日時を渡して書く（FR-042）', async () => {
    expect(await editProject(deps, OWNER, 1, values(), times)).toEqual({ status: 'saved' });
    expect(projects.edit).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: '作り物の受託開発' }),
      times,
    );
  });

  it('無い id なら書かない', async () => {
    deps.projects = projects = fakeProjects(null);
    expect(await editProject(deps, OWNER, 9, values(), times)).toEqual({ status: 'not-found' });
    expect(projects.edit).not.toHaveBeenCalled();
  });

  it('先に書き換えられていたら、送られた値を残して知らせる（FR-042）', async () => {
    projects.edit.mockResolvedValue({ ok: false, reason: 'conflict' } as never);
    const sent = values({ title: '手元で直した題' });
    expect(await editProject(deps, OWNER, 1, sent, times)).toEqual({
      status: 'conflict',
      values: sent,
    });
  });
});

describe('deleteProject', () => {
  it('ある実績を消す', async () => {
    expect(await deleteProject(projects, OWNER, 1)).toEqual({ status: 'deleted' });
    expect(projects.delete).toHaveBeenCalledWith(1);
  });

  it('無い実績なら not-found', async () => {
    projects.delete.mockResolvedValue({ ok: false });
    expect(await deleteProject(projects, OWNER, 9)).toEqual({ status: 'not-found' });
  });
});
