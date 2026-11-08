import { describe, expect, it, vi } from 'vitest';
import { listSkills } from '@/features/skill/application/list-skills';
import { registerSkill } from '@/features/skill/application/register-skill';
import { parseSkillContent, toSkillFormValues } from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * スキルの入力の読み替えと、経験年数の上書き（specs/001-career-and-project/spec.md の
 * FR-033・FR-034・FR-040）。月数の数え方は tests/unit/period-experience.test.ts が持つ。
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
  hasId: vi.fn(),
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
        { id: 1, uid: UID, name: 'Go', monthsOverride: null, periods },
      ]),
    });
    expect(await listSkills(skills, NOW)).toEqual([
      {
        id: 1,
        uid: UID,
        name: 'Go',
        monthsOverride: null,
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
        { id: 1, uid: UID, name: 'Go', monthsOverride: 71, periods },
      ]),
    });
    expect(await listSkills(skills, NOW)).toEqual([
      { id: 1, uid: UID, name: 'Go', monthsOverride: 71, computedMonths: 24, experienceMonths: 71 },
    ]);
  });
});

describe('registerSkill', () => {
  it('作り手でなければ何も書かない（FR-040）', async () => {
    const skills = fakeSkills();
    expect(
      await registerSkill(skills, null, { name: 'Go', overrideYears: '', overrideMonths: '' }),
    ).toEqual({ status: 'forbidden' });
    expect(skills.register).not.toHaveBeenCalled();
  });
});
