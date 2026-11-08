import { describe, expect, it } from 'vitest';
import { listCareerProjects } from '@/features/career/application/list-career-projects';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import {
  countExperienceMonths,
  periodsOverlap,
  toYearsAndMonths,
  type CalendarDate,
  type Period,
} from '@/shared/domain/period';

/**
 * 経験年数の数え方（specs/001-career-and-project/spec.md の FR-033・SC-004）。月を単位に、
 * 両端の月を含めて数え、重なる月は 1 回だけ数える。終わりの日が空なら日本時間の今月まで。
 * 上書きの月数を使うことは、スキルのユースケースの検査が持つ。
 * 職歴の実績とスキル（FR-017・FR-035）は、期間が両端を含むことに合わせ、端の日だけ接する期間を
 * 重なるとみなす既定で確かめる（plan.md の U6 の残り）。
 */

const period = (startedOn: string, endedOn: string | null): Period => ({
  startedOn: startedOn as CalendarDate,
  endedOn: endedOn as CalendarDate | null,
});

/** 日本時間で 2026-11-04 の正午 */
const NOW = new Date('2026-11-04T03:00:00Z');

describe('countExperienceMonths（SC-004）', () => {
  it('両端の月を含めて数える。2020-04-01〜2022-03-31 は 24 か月', () => {
    expect(countExperienceMonths([period('2020-04-01', '2022-03-31')], NOW)).toBe(24);
  });

  it('日の部分を使わない。同じ月の 1 日と 31 日も、月の途中から月の途中も同じ', () => {
    expect(countExperienceMonths([period('2020-04-30', '2020-04-30')], NOW)).toBe(1);
    expect(countExperienceMonths([period('2020-04-30', '2020-05-01')], NOW)).toBe(2);
  });

  it('重ならない 2 件は、それぞれの月数を足す', () => {
    expect(
      countExperienceMonths(
        [period('2020-01-01', '2020-06-30'), period('2021-01-01', '2021-03-31')],
        NOW,
      ),
    ).toBe(6 + 3);
  });

  it('一部が重なる 2 件は、重なる月を 1 回だけ数える', () => {
    // 2020-01〜2020-06 と 2020-04〜2020-09 は、2020-01〜2020-09 の 9 か月
    expect(
      countExperienceMonths(
        [period('2020-01-15', '2020-06-15'), period('2020-04-01', '2020-09-30')],
        NOW,
      ),
    ).toBe(9);
  });

  it('同じ月で終わりと始まりが接する 2 件は、その月を 1 回だけ数える', () => {
    expect(
      countExperienceMonths(
        [period('2020-01-01', '2020-03-10'), period('2020-03-20', '2020-05-31')],
        NOW,
      ),
    ).toBe(5);
  });

  it('一方が他方を含む 2 件は、外側の月数になる', () => {
    expect(
      countExperienceMonths(
        [period('2019-01-01', '2020-12-31'), period('2019-06-01', '2019-08-31')],
        NOW,
      ),
    ).toBe(24);
  });

  it('終わりの日が空の実績は、日本時間の今月までを数える', () => {
    // 2026-01〜2026-11 の 11 か月
    expect(countExperienceMonths([period('2026-01-01', null)], NOW)).toBe(11);
  });

  it('月の区切りは日本時間。UTC で 10 月 31 日 15 時は、日本時間で 11 月', () => {
    const tokyoNovember = new Date('2026-10-31T15:00:00Z');
    expect(countExperienceMonths([period('2026-10-01', null)], tokyoNovember)).toBe(2);
    const tokyoOctober = new Date('2026-10-31T14:59:59Z');
    expect(countExperienceMonths([period('2026-10-01', null)], tokyoOctober)).toBe(1);
  });

  it('終わりの日が空の実績と、終わった実績が重なれば、1 回だけ数える', () => {
    expect(
      countExperienceMonths([period('2026-01-01', null), period('2025-11-01', '2026-02-28')], NOW),
    ).toBe(13);
  });

  it('期間が無ければ 0', () => {
    expect(countExperienceMonths([], NOW)).toBe(0);
  });
});

describe('toYearsAndMonths', () => {
  it.each([
    [24, { years: 2, months: 0 }],
    [71, { years: 5, months: 11 }],
    [0, { years: 0, months: 0 }],
  ])('%i か月は %j', (months, expected) => {
    expect(toYearsAndMonths(months)).toEqual(expected);
  });
});

describe('periodsOverlap（FR-017・FR-035、plan.md の U6 の残りの既定）', () => {
  it.each([
    ['一部が重なる', period('2020-01-01', '2020-06-30'), period('2020-04-01', '2020-09-30'), true],
    [
      '一方が他方を含む',
      period('2019-01-01', '2020-12-31'),
      period('2019-06-01', '2019-08-31'),
      true,
    ],
    [
      '端の日だけ接する',
      period('2020-01-01', '2020-03-31'),
      period('2020-03-31', '2020-06-30'),
      true,
    ],
    ['1 日離れる', period('2020-01-01', '2020-03-30'), period('2020-03-31', '2020-06-30'), false],
    ['重ならない', period('2018-01-01', '2018-12-31'), period('2020-01-01', '2020-12-31'), false],
    [
      '終わりの日が空の期間は終わらない',
      period('2015-01-01', null),
      period('2026-01-01', null),
      true,
    ],
    [
      '終わりの日が空でも、始まる前は重ならない',
      period('2020-01-01', null),
      period('2019-01-01', '2019-12-31'),
      false,
    ],
  ])('%s', (_, a, b, expected) => {
    expect(periodsOverlap(a, b)).toBe(expected);
    expect(periodsOverlap(b, a)).toBe(expected);
  });
});

describe('職歴の実績とスキル（FR-017・FR-035）', () => {
  const project = (organizationId: number, title: string, p: Period, skills: string[]) => ({
    organizationId,
    title,
    period: p,
    skills,
  });
  const careers = {
    listProjectsOfOrganization: async () => [
      project(1, '重なる実績', period('2021-04-01', '2022-03-31'), ['Go', 'TypeScript']),
      project(1, '後の実績', period('2023-04-01', null), ['Rust']),
      project(2, '別の組織の実績', period('2021-04-01', null), ['Python']),
      project(1, '端で接する実績', period('2020-01-01', '2020-04-01'), ['TypeScript']),
    ],
  } as unknown as CareerRepository;
  const career = {
    organization: { id: 1, name: '作り物株式会社', nameMasked: 'ある会社' },
    period: period('2020-04-01', '2023-03-31'),
  };

  it('同じ組織で期間が重なる実績を選び、そのスキルを重ねずに名前の順で合わせる', async () => {
    const { projects, skills } = await listCareerProjects(careers, career, 'all');
    expect(projects.map((p) => p.title)).toEqual(['重なる実績', '端で接する実績']);
    expect(skills).toEqual(['Go', 'TypeScript']);
  });
});
