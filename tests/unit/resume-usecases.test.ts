import { describe, expect, it, vi } from 'vitest';
import { createResume } from '@/features/resume/application/create-resume';
import {
  editResumeCareer,
  editResumeSkillOverrides,
} from '@/features/resume/application/edit-resume-rows';
import { editResumeSettings } from '@/features/resume/application/edit-resume-settings';
import { changeResumeStatus } from '@/features/resume/application/change-resume-status';
import { deleteResume } from '@/features/resume/application/delete-resume';
import { hashLimitedKey } from '@/features/resume/domain/limited-key';
import type { ResumeSources } from '@/features/resume/domain/resume';
import type {
  CreateResumeField,
  CreateResumeFormValues,
} from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 職務経歴書のユースケース（specs/002-resume/spec.md の FR-003・FR-011・FR-012・FR-031・FR-033）。
 * Repository は作り物の実装を渡す（docs/SOFTWARE_DESIGN.md の Dependency Injection）。D1 の上での
 * 動きは tests/workers/resume-repository.test.ts と tests/workers/resume-edit.test.ts が持つ
 */

const OWNER: Author = { email: 'owner@synsk.test' };
const TIMES = { openedUpdatedAt: '2026-11-01T00:00:00.000Z', now: '2026-11-04T00:00:00.000Z' };

const SOURCES: ResumeSources = {
  careers: [
    {
      id: 1,
      organizationName: '作り物株式会社',
      organizationNameMasked: 'ある会社',
      role: '作り物の肩書',
      isMasked: true,
      period: { startedOn: '2020-04-01' as CalendarDate, endedOn: null },
      description: null,
      url: null,
    },
  ],
  projects: [],
  educations: [],
};

type Repo = ResumeRepository;
const OK = { ok: true } as const;

const fakeResumes = (sources: ResumeSources = SOURCES) => ({
  readSources: vi.fn<Repo['readSources']>(async () => sources),
  create: vi.fn<Repo['create']>(async () => ({ id: 7 })),
  list: vi.fn<Repo['list']>(),
  findForEdit: vi.fn<Repo['findForEdit']>(),
  findLimitedIdForVisitor: vi.fn<Repo['findLimitedIdForVisitor']>(),
  readContent: vi.fn<Repo['readContent']>(),
  editSettings: vi.fn<Repo['editSettings']>(async () => OK),
  changeStatus: vi.fn<Repo['changeStatus']>(async () => OK),
  editCareer: vi.fn<Repo['editCareer']>(async () => OK),
  editProject: vi.fn<Repo['editProject']>(async () => OK),
  editEducation: vi.fn<Repo['editEducation']>(async () => OK),
  editSkillOverrides: vi.fn<Repo['editSkillOverrides']>(async () => OK),
  delete: vi.fn<Repo['delete']>(async () => ({ ok: true })),
  hasId: vi.fn<Repo['hasId']>(async () => true),
  hasRow: vi.fn<Repo['hasRow']>(async () => true),
});

const createValues = (overrides: Partial<CreateResumeFormValues> = {}): CreateResumeFormValues => ({
  title: '作り物の提出先',
  audience: '',
  expires: '',
  careerIds: ['1'],
  projectIds: [],
  educationIds: [],
  ...overrides,
});

describe('createResume', () => {
  it('限定公開用か公開用かを選ばなければ、限定公開用で作る（FR-003）', async () => {
    const resumes = fakeResumes();
    const outcome = await createResume(resumes, OWNER, createValues());
    expect(outcome.status).toBe('created');
    expect(resumes.create).toHaveBeenCalledWith(expect.objectContaining({ audience: 'limited' }));
  });

  it('鍵を作り、ハッシュだけを渡し、鍵の平文は結果でだけ返す（FR-011・FR-012）', async () => {
    const resumes = fakeResumes();
    const outcome = await createResume(resumes, OWNER, createValues());
    if (outcome.status !== 'created' || outcome.key === null) throw new Error(outcome.status);
    const saved = resumes.create.mock.calls[0][0];
    expect(saved.limitedTokenHash).toBe(await hashLimitedKey(outcome.key));
    expect(JSON.stringify(saved)).not.toContain(outcome.key);
  });

  it('識別子は uid（FR-037）', async () => {
    const resumes = fakeResumes();
    const outcome = await createResume(resumes, OWNER, createValues());
    if (outcome.status !== 'created') throw new Error(outcome.status);
    expect(outcome.slug).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('期限を日本時間で読み、UTC で保存する（plan.md の U9 の仮の形）', async () => {
    const resumes = fakeResumes();
    await createResume(resumes, OWNER, createValues({ expires: '2026-12-01T09:00' }));
    expect(resumes.create.mock.calls[0][0].limitedExpiresAt).toBe('2026-12-01T00:00:00.000Z');
  });

  it('期限が空なら期限なし（FR-013）', async () => {
    const resumes = fakeResumes();
    await createResume(resumes, OWNER, createValues());
    expect(resumes.create.mock.calls[0][0].limitedExpiresAt).toBeNull();
  });

  it('作り手でなければ、何も読まず何も書かない（FR-033）', async () => {
    const resumes = fakeResumes();
    expect(await createResume(resumes, null, createValues())).toEqual({ status: 'forbidden' });
    expect(resumes.readSources).not.toHaveBeenCalled();
    expect(resumes.create).not.toHaveBeenCalled();
  });

  it('選んだ行が無ければ作らない', async () => {
    const resumes = fakeResumes({ careers: [], projects: [], educations: [] });
    const outcome = await createResume(resumes, OWNER, createValues());
    expect(outcome).toMatchObject({ status: 'invalid', errors: { selection: 'source-missing' } });
    expect(resumes.create).not.toHaveBeenCalled();
  });

  it.each([
    ['題が空', { title: ' ' }, 'title'],
    ['期限の形が違う', { expires: '2026-02-30T09:00' }, 'expires'],
    ['公開用', { audience: 'public' }, 'audience'],
    ['id の形が違う', { careerIds: ['x'] }, 'selection'],
  ] satisfies [string, Partial<CreateResumeFormValues>, CreateResumeField][])(
    '%s なら作らず、送られた値を返す',
    async (_, overrides, field) => {
      const resumes = fakeResumes();
      const values = createValues(overrides);
      const outcome = await createResume(resumes, OWNER, values);
      expect(outcome).toMatchObject({ status: 'invalid', values });
      if (outcome.status === 'invalid') expect(outcome.errors[field]).toBeDefined();
      expect(resumes.create).not.toHaveBeenCalled();
    },
  );
});

describe('書き込みは作り手だけ（FR-033）', () => {
  it.each([
    [
      '設定',
      (r: ResumeRepository) => editResumeSettings(r, null, 1, { title: 't', expires: '' }, TIMES),
    ],
    ['状態', (r: ResumeRepository) => changeResumeStatus(r, null, 1, 'published', TIMES)],
    [
      '写した職歴',
      (r: ResumeRepository) =>
        editResumeCareer(
          r,
          null,
          { id: 1, rowId: 1 },
          {
            organizationName: 'a',
            role: 'b',
            startedOn: '2020-04-01',
            endedOn: '',
            description: '',
            url: '',
          },
          TIMES,
        ),
    ],
    [
      '上書き',
      (r: ResumeRepository) =>
        editResumeSkillOverrides(r, null, 1, [{ name: 'Go', years: '1', months: '0' }], TIMES),
    ],
    ['削除', (r: ResumeRepository) => deleteResume(r, null, 1)],
  ])('%s', async (_, run) => {
    const resumes = fakeResumes();
    expect(await run(resumes)).toEqual({ status: 'forbidden' });
    for (const fn of Object.values(resumes)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('写した行の編集（FR-031）', () => {
  const careerValues = {
    organizationName: '直した組織名',
    role: '肩書',
    startedOn: '2020-04-01',
    endedOn: '',
    description: '',
    url: '',
  };

  it('秘匿化するかどうかを渡さない', async () => {
    const resumes = fakeResumes();
    await editResumeCareer(resumes, OWNER, { id: 1, rowId: 2 }, careerValues, TIMES);
    const content = resumes.editCareer.mock.calls[0][2];
    expect(content).not.toHaveProperty('isMasked');
    expect(content.organizationName).toBe('直した組織名');
  });

  it('項目の不備は書かずに返す', async () => {
    const resumes = fakeResumes();
    const values = { ...careerValues, role: '', url: 'ftp://x' };
    expect(await editResumeCareer(resumes, OWNER, { id: 1, rowId: 2 }, values, TIMES)).toEqual({
      status: 'invalid',
      errors: { role: 'missing', url: 'invalid' },
      values,
    });
    expect(resumes.editCareer).not.toHaveBeenCalled();
  });

  it('先に書き換えられていたら、送られた値を返す（FR-038）', async () => {
    const resumes = fakeResumes();
    resumes.editCareer.mockResolvedValue({ ok: false, reason: 'conflict' });
    expect(
      await editResumeCareer(resumes, OWNER, { id: 1, rowId: 2 }, careerValues, TIMES),
    ).toEqual({ status: 'conflict', values: careerValues });
  });

  it('上書きを年と月で受け取り、月数で渡す。両方が空の行は上書きなし', async () => {
    const resumes = fakeResumes();
    await editResumeSkillOverrides(
      resumes,
      OWNER,
      1,
      [
        { name: 'Go', years: '5', months: '11' },
        { name: 'Rust', years: '', months: '' },
      ],
      TIMES,
    );
    expect(resumes.editSkillOverrides.mock.calls[0][1]).toEqual([{ skillName: 'Go', months: 71 }]);
  });

  it('月が 12 以上の上書きは書かない', async () => {
    const resumes = fakeResumes();
    const outcome = await editResumeSkillOverrides(
      resumes,
      OWNER,
      1,
      [{ name: 'Go', years: '1', months: '12' }],
      TIMES,
    );
    expect(outcome).toMatchObject({ status: 'invalid', errors: { invalidRows: [0] } });
    expect(resumes.editSkillOverrides).not.toHaveBeenCalled();
  });
});
