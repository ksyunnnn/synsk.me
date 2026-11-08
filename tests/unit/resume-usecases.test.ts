import { describe, expect, it, vi } from 'vitest';
import { addResumeRows } from '@/features/resume/application/add-resume-rows';
import { createResume } from '@/features/resume/application/create-resume';
import {
  editResumeCareer,
  editResumeSkillOverrides,
} from '@/features/resume/application/edit-resume-rows';
import { editResumeSettings } from '@/features/resume/application/edit-resume-settings';
import { changeResumeStatus } from '@/features/resume/application/change-resume-status';
import { deleteResume } from '@/features/resume/application/delete-resume';
import { regenerateResumeUrl } from '@/features/resume/application/regenerate-resume-url';
import type { ResumeForEdit, ResumeSources } from '@/features/resume/domain/resume';
import type {
  CreateResumeField,
  CreateResumeFormValues,
} from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 職務経歴書のユースケース（specs/002-resume/spec.md の FR-003・FR-012・FR-031・FR-033・FR-040）。
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
  create: vi.fn<Repo['create']>(async () => ({
    id: 7,
    uid: '0123456789abcdef0123456789abcdef',
    updatedAt: '2026-11-07T00:00:00.000Z',
  })),
  addRows: vi.fn<Repo['addRows']>(async () => OK),
  list: vi.fn<Repo['list']>(),
  findForEdit: vi.fn<Repo['findForEdit']>(),
  findIdByUid: vi.fn<Repo['findIdByUid']>(),
  findRowIdByUid: vi.fn<Repo['findRowIdByUid']>(),
  findLimitedIdForVisitor: vi.fn<Repo['findLimitedIdForVisitor']>(),
  readContent: vi.fn<Repo['readContent']>(),
  editSettings: vi.fn<Repo['editSettings']>(async () => OK),
  changeStatus: vi.fn<Repo['changeStatus']>(async () => OK),
  regenerateLimitedSlug: vi.fn<Repo['regenerateLimitedSlug']>(async () => OK),
  editCareer: vi.fn<Repo['editCareer']>(async () => OK),
  editProject: vi.fn<Repo['editProject']>(async () => OK),
  editEducation: vi.fn<Repo['editEducation']>(async () => OK),
  editSkillOverrides: vi.fn<Repo['editSkillOverrides']>(async () => OK),
  delete: vi.fn<Repo['delete']>(async () => ({ ok: true })),
  hasId: vi.fn<Repo['hasId']>(async () => true),
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
    expect(outcome).toMatchObject({ status: 'created', audience: 'limited' });
    expect(resumes.create).toHaveBeenCalledWith(expect.objectContaining({ audience: 'limited' }));
  });

  it('識別子は uid で、渡した識別子を結果で返す（FR-012・FR-037）', async () => {
    const resumes = fakeResumes();
    const outcome = await createResume(resumes, OWNER, createValues());
    if (outcome.status !== 'created') throw new Error(outcome.status);
    expect(outcome.slug).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(resumes.create.mock.calls[0][0].slug).toBe(outcome.slug);
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
    ['URL の出し直し', (r: ResumeRepository) => regenerateResumeUrl(r, null, 1, TIMES)],
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
    [
      '足す',
      (r: ResumeRepository) => addResumeRows(r, null, { id: 1, kind: 'careers' }, ['1'], TIMES),
    ],
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

describe('regenerateResumeUrl（FR-040）', () => {
  it('新しい uid を渡し、保存したら saved を返す', async () => {
    const resumes = fakeResumes();
    expect(await regenerateResumeUrl(resumes, OWNER, 1, TIMES)).toEqual({ status: 'saved' });
    const [id, slug, times] = resumes.regenerateLimitedSlug.mock.calls[0];
    expect(id).toBe(1);
    expect(slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(times).toEqual(TIMES);
  });

  it('呼ぶたびに違う uid を作る', async () => {
    const resumes = fakeResumes();
    await regenerateResumeUrl(resumes, OWNER, 1, TIMES);
    await regenerateResumeUrl(resumes, OWNER, 1, TIMES);
    const [first, second] = resumes.regenerateLimitedSlug.mock.calls.map((call) => call[1]);
    expect(first).not.toBe(second);
  });

  it('先に書き換えられていたら conflict、公開用か無い id なら not-found', async () => {
    const resumes = fakeResumes();
    resumes.regenerateLimitedSlug.mockResolvedValueOnce({ ok: false, reason: 'conflict' });
    expect(await regenerateResumeUrl(resumes, OWNER, 1, TIMES)).toMatchObject({
      status: 'conflict',
    });
    resumes.regenerateLimitedSlug.mockResolvedValueOnce({ ok: false, reason: 'not-found' });
    expect(await regenerateResumeUrl(resumes, OWNER, 1, TIMES)).toEqual({ status: 'not-found' });
  });
});

describe('addResumeRows（FR-041）', () => {
  const RESUME: ResumeForEdit = {
    id: 1,
    title: '作り物の提出先',
    slug: 'x',
    audience: 'limited',
    status: 'draft',
    limitedExpiresAt: null,
    createdAt: TIMES.openedUpdatedAt,
    updatedAt: TIMES.openedUpdatedAt,
    careers: [],
    projects: [],
    educations: [],
    skillOverrides: [],
  };

  const PROJECT_SOURCES: ResumeSources = {
    careers: [],
    projects: [
      {
        id: 5,
        organizationName: '作り物株式会社',
        organizationNameMasked: 'ある会社',
        kind: 'talk',
        title: '作り物の登壇',
        titleMasked: 'ある登壇',
        isMasked: true,
        period: { startedOn: '2022-04-01' as CalendarDate, endedOn: null },
        description: '作り物の本文',
        url: null,
        skills: [
          { name: 'Go', monthsOverride: 24 },
          { name: 'Rust', monthsOverride: null },
        ],
      },
    ],
    educations: [],
  };

  const withResume = (sources: ResumeSources, resume: ResumeForEdit = RESUME) => {
    const resumes = fakeResumes(sources);
    resumes.findForEdit.mockResolvedValue(resume);
    return resumes;
  };

  it('選んだ写し元を、作るときと同じ写し方で写して渡す。スキルと上書きも写す', async () => {
    const resumes = withResume(PROJECT_SOURCES);
    expect(await addResumeRows(resumes, OWNER, { id: 1, kind: 'projects' }, ['5'], TIMES)).toEqual({
      status: 'saved',
    });
    expect(resumes.readSources).toHaveBeenCalledWith({
      careerIds: [],
      projectIds: [5],
      educationIds: [],
    });
    const [id, content, times] = resumes.addRows.mock.calls[0];
    expect(id).toBe(1);
    expect(times).toEqual(TIMES);
    expect(content.projects).toEqual([
      expect.objectContaining({
        projectId: 5,
        organizationName: '作り物株式会社',
        title: '作り物の登壇',
        description: '作り物の本文',
        isMasked: true,
        skills: ['Go', 'Rust'],
      }),
    ]);
    expect(content.skillOverrides).toEqual([{ skillName: 'Go', months: 24 }]);
    expect(content.careers).toEqual([]);
  });

  it('何も選ばなければ足さない', async () => {
    const resumes = withResume(PROJECT_SOURCES);
    expect(await addResumeRows(resumes, OWNER, { id: 1, kind: 'projects' }, [], TIMES)).toEqual({
      status: 'invalid',
      errors: { selection: 'missing' },
      values: [],
    });
    expect(resumes.addRows).not.toHaveBeenCalled();
  });

  it('id の形が違えば、何も読まずに返す', async () => {
    const resumes = withResume(PROJECT_SOURCES);
    expect(
      await addResumeRows(resumes, OWNER, { id: 1, kind: 'projects' }, ['x'], TIMES),
    ).toMatchObject({ status: 'invalid', errors: { selection: 'invalid' } });
    expect(resumes.findForEdit).not.toHaveBeenCalled();
  });

  it('開いた後に選んだ写し元が消えていたら、作るときと同じく足さずに知らせる', async () => {
    const resumes = withResume({ careers: [], projects: [], educations: [] });
    expect(await addResumeRows(resumes, OWNER, { id: 1, kind: 'projects' }, ['5'], TIMES)).toEqual({
      status: 'invalid',
      errors: { selection: 'source-missing' },
      values: ['5'],
    });
    expect(resumes.addRows).not.toHaveBeenCalled();
  });

  it('既に写した写し元は足さない', async () => {
    const resumes = withResume(SOURCES, {
      ...RESUME,
      careers: [
        {
          id: 9,
          careerId: 1,
          organizationName: '作り物株式会社',
          role: '作り物の肩書',
          period: { startedOn: '2020-04-01' as CalendarDate, endedOn: null },
          description: null,
          url: null,
          isMasked: true,
        },
      ],
    });
    expect(
      await addResumeRows(resumes, OWNER, { id: 1, kind: 'careers' }, ['1'], TIMES),
    ).toMatchObject({ status: 'invalid', errors: { selection: 'already-copied' } });
    expect(resumes.addRows).not.toHaveBeenCalled();
  });

  it('開いた後に書き換えられていたら、送られた値を返す（FR-038）', async () => {
    const resumes = withResume(SOURCES, { ...RESUME, updatedAt: TIMES.now });
    expect(await addResumeRows(resumes, OWNER, { id: 1, kind: 'careers' }, ['1'], TIMES)).toEqual({
      status: 'conflict',
      values: ['1'],
    });
    expect(resumes.addRows).not.toHaveBeenCalled();

    const raced = withResume(SOURCES);
    raced.addRows.mockResolvedValue({ ok: false, reason: 'conflict' });
    expect(await addResumeRows(raced, OWNER, { id: 1, kind: 'careers' }, ['1'], TIMES)).toEqual({
      status: 'conflict',
      values: ['1'],
    });
  });

  it('無い職務経歴書なら not-found', async () => {
    const resumes = fakeResumes();
    resumes.findForEdit.mockResolvedValue(null);
    expect(await addResumeRows(resumes, OWNER, { id: 1, kind: 'careers' }, ['1'], TIMES)).toEqual({
      status: 'not-found',
    });
  });
});
