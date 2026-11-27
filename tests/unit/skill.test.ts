import { describe, expect, it, vi } from 'vitest';
import { listSkills } from '@/features/skill/application/list-skills';
import { registerSkill } from '@/features/skill/application/register-skill';
import {
  parseSkillContent,
  toSkillFormValues,
  type SkillSummary,
} from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * スキルの入力の読み替えと、経験年数の上書き（specs/001-career-and-project/spec.md の
 * FR-031・FR-033・FR-034・FR-040）。月数の数え方は tests/unit/period-experience.test.ts が持つ。
 */

const NOW = new Date('2026-11-04T03:00:00Z');
/** 作り物の uid */
const UID = '0123456789abcdef0123456789abcdef';

const fakeSkills = (overrides: Partial<SkillRepository> = {}): SkillRepository => ({
  listWithPeriods: vi.fn(async () => []),
  findById: vi.fn(),
  findIdByUid: vi.fn(),
  register: vi.fn(async () => ({ ok: true as const, id: 1, uid: UID })),
  edit: vi.fn(),
  delete: vi.fn(),
  ...overrides,
});

describe('parseSkillContent', () => {
  it('上書きを年と月で受け取り、月数にする（FR-034）', () => {
    expect(
      parseSkillContent({ name: ' TypeScript ', overrideYears: '5', overrideMonths: '11' }),
    ).toEqual({
      ok: true,
      content: { name: 'TypeScript', monthsOverride: 71 },
    });
  });

  it('年と月の両方が空なら上書きしない', () => {
    expect(parseSkillContent({ name: 'Go', overrideYears: '', overrideMonths: '' })).toEqual({
      ok: true,
      content: { name: 'Go', monthsOverride: null },
    });
  });

  it('片方だけなら、空の方を 0 とする', () => {
    expect(parseSkillContent({ name: 'Go', overrideYears: '', overrideMonths: '3' })).toMatchObject(
      {
        content: { monthsOverride: 3 },
      },
    );
  });

  it.each([
    [{ name: '' }, { name: 'missing' }],
    [{ overrideYears: '-1' }, { overrideYears: 'invalid' }],
    [{ overrideYears: '1.5' }, { overrideYears: 'invalid' }],
    [{ overrideMonths: '12' }, { overrideMonths: 'invalid' }],
  ])('%j の不備を返す', (overrides, errors) => {
    expect(
      parseSkillContent({ name: 'Go', overrideYears: '1', overrideMonths: '0', ...overrides }),
    ).toEqual({ ok: false, errors });
  });

  it('上書きの月数を年と月のフォームの値に戻す', () => {
    expect(toSkillFormValues({ name: 'Go', monthsOverride: 71 })).toEqual({
      name: 'Go',
      overrideYears: '5',
      overrideMonths: '11',
    });
  });
});

describe('listSkills', () => {
  const periods = [
    { startedOn: '2020-04-01' as CalendarDate, endedOn: '2022-03-31' as CalendarDate },
  ];

  it('実績の期間から求めた月数を使う（FR-033）', async () => {
    const skills = fakeSkills({
      listWithPeriods: vi.fn(async () => [
        { id: 1, uid: UID, name: 'Go', monthsOverride: null, parentId: null, role: null, periods },
      ]),
    });
    expect(await listSkills(skills, NOW)).toEqual([
      {
        id: 1,
        uid: UID,
        name: 'Go',
        monthsOverride: null,
        parentId: null,
        role: null,
        computedMonths: 24,
        experienceMonths: 24,
      },
    ]);
  });

  it('管理画面の一覧は、サイトに載せない実績の期間も数える（FR-033）', async () => {
    const skills = fakeSkills();
    await listSkills(skills, NOW);
    expect(skills.listWithPeriods).toHaveBeenCalledWith('all');
  });

  it('上書きの月数があれば、求めた月数の代わりに使う（FR-034）', async () => {
    const skills = fakeSkills({
      listWithPeriods: vi.fn(async () => [
        { id: 1, uid: UID, name: 'Go', monthsOverride: 71, parentId: null, role: null, periods },
      ]),
    });
    expect(await listSkills(skills, NOW)).toEqual([
      {
        id: 1,
        uid: UID,
        name: 'Go',
        monthsOverride: 71,
        parentId: null,
        role: null,
        computedMonths: 24,
        experienceMonths: 71,
      },
    ]);
  });

  const at = (startedOn: string, endedOn: string) => ({
    startedOn: startedOn as CalendarDate,
    endedOn: endedOn as CalendarDate,
  });
  const experienceOf = (summaries: SkillSummary[], name: string) =>
    summaries.find((skill) => skill.name === name)?.computedMonths;

  it('親は、親か子のどれかをつないだ実績の期間をつなぎ、重なりを除いて数える（FR-033）', async () => {
    const skills = fakeSkills({
      listWithPeriods: vi.fn(async () => [
        {
          id: 1,
          uid: UID,
          name: 'Cloudflare',
          monthsOverride: null,
          parentId: null,
          role: null,
          periods: [at('2020-04-01', '2021-03-31')],
        },
        {
          id: 2,
          uid: UID,
          name: 'D1',
          monthsOverride: null,
          parentId: 1,
          role: null,
          periods: [at('2020-10-01', '2022-03-31')],
        },
        {
          id: 3,
          uid: UID,
          name: 'Workers',
          monthsOverride: null,
          parentId: 1,
          role: null,
          periods: [at('2024-04-01', '2024-09-30')],
        },
      ]),
    });
    const summaries = await listSkills(skills, NOW);
    expect(experienceOf(summaries, 'Cloudflare')).toBe(24 + 6);
    expect(experienceOf(summaries, 'D1')).toBe(18);
    expect(experienceOf(summaries, 'Workers')).toBe(6);
  });

  it('親と子の両方をつないだ実績の期間は、親で 1 回だけ数える（FR-033）', async () => {
    const both = at('2020-04-01', '2022-03-31');
    const skills = fakeSkills({
      listWithPeriods: vi.fn(async () => [
        {
          id: 1,
          uid: UID,
          name: 'AWS',
          monthsOverride: null,
          parentId: null,
          role: null,
          periods: [both],
        },
        {
          id: 2,
          uid: UID,
          name: 'Lambda',
          monthsOverride: null,
          parentId: 1,
          role: null,
          periods: [both],
        },
      ]),
    });
    expect(experienceOf(await listSkills(skills, NOW), 'AWS')).toBe(24);
  });

  it('親に上書きの月数があれば、子の期間を足した月数の代わりに使う（FR-034）', async () => {
    const skills = fakeSkills({
      listWithPeriods: vi.fn(async () => [
        {
          id: 1,
          uid: UID,
          name: 'Firebase',
          monthsOverride: 5,
          parentId: null,
          role: null,
          periods: [],
        },
        {
          id: 2,
          uid: UID,
          name: 'Firestore',
          monthsOverride: null,
          parentId: 1,
          role: null,
          periods: [at('2020-04-01', '2022-03-31')],
        },
      ]),
    });
    expect(
      (await listSkills(skills, NOW)).find((skill) => skill.name === 'Firebase'),
    ).toMatchObject({ computedMonths: 24, experienceMonths: 5 });
  });
});

describe('registerSkill', () => {
  it('オーナーでなければ何も書かない（FR-040）', async () => {
    const skills = fakeSkills();
    expect(
      await registerSkill(skills, null, { name: 'Go', overrideYears: '', overrideMonths: '' }),
    ).toEqual({ status: 'forbidden' });
    expect(skills.register).not.toHaveBeenCalled();
  });
});
