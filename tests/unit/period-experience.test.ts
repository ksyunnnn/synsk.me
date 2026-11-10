import { describe, expect, it } from 'vitest';
import {
  countExperienceMonths,
  periodsOverlap,
  projectsOfCareer,
  skillsOfCareer,
  toYearsAndMonths,
  type CalendarDate,
  type Period,
} from '@/shared/domain/period';

/**
 * 経験年数の数え方（specs/001-career-and-project/spec.md の FR-033・SC-004）。月を単位に、
 * 両端の月を含めて数え、重なる月は 1 回だけ数える。終わりの日が空なら日本時間の今月まで。
 * 上書きの月数を使うことは、スキルのユースケースの検査が持つ。
 * 職歴の実績とスキル（FR-017・FR-035）は、同じ組織で期間が重なる実績から求める。終わりの日も期間に
 * 含め、端の日だけ接する組も重なるとする（plan.md の U6 の残り、2026-11-10 のオーナーの決定）。
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

describe('periodsOverlap（FR-017。終わりの日も期間に含める）', () => {
  it('一部が重なれば重なる', () => {
    expect(
      periodsOverlap(period('2020-01-01', '2020-06-30'), period('2020-04-01', '2020-09-30')),
    ).toBe(true);
  });

  it('端の日だけ接する組も重なる。前後を入れ替えても同じ', () => {
    const career = period('2020-01-01', '2020-03-31');
    const project = period('2020-03-31', '2020-05-31');
    expect(periodsOverlap(career, project)).toBe(true);
    expect(periodsOverlap(project, career)).toBe(true);
  });

  it('1 日でも離れれば重ならない', () => {
    expect(
      periodsOverlap(period('2020-01-01', '2020-03-30'), period('2020-03-31', '2020-05-31')),
    ).toBe(false);
    expect(
      periodsOverlap(period('2020-03-31', '2020-05-31'), period('2020-01-01', '2020-03-30')),
    ).toBe(false);
  });

  it('終わりの日が空なら続いている。後に始まる期間と重なり、前に終わった期間とは重ならない', () => {
    const ongoing = period('2022-04-01', null);
    expect(periodsOverlap(ongoing, period('2030-01-01', '2030-01-01'))).toBe(true);
    expect(periodsOverlap(ongoing, period('2022-03-31', '2022-04-01'))).toBe(true);
    expect(periodsOverlap(ongoing, period('2021-01-01', '2022-03-31'))).toBe(false);
    expect(periodsOverlap(ongoing, period('2023-01-01', null))).toBe(true);
  });
});

describe('職歴の実績とスキル（FR-017・FR-035）', () => {
  const career = { organizationId: 1, period: period('2020-04-01', '2022-03-31') };
  const project = (
    name: string,
    organizationId: number,
    p: Period,
    skills: string[],
    status: 'draft' | 'published' = 'published',
  ) => ({ name, organizationId, period: p, skills, status });

  const projects = [
    project('同じ組織で重なる', 1, period('2021-01-01', '2021-06-30'), ['TypeScript', 'React']),
    project('同じ組織で端の日だけ接する', 1, period('2022-03-31', null), ['Go']),
    project('同じ組織で重ならない', 1, period('2022-04-01', null), ['Rust']),
    project('別の組織で重なる', 2, period('2021-01-01', '2021-06-30'), ['PHP']),
    project('サイトに載せない', 1, period('2020-05-01', '2020-06-30'), ['React', 'Swift'], 'draft'),
  ];

  it('職歴の実績は、同じ組織で期間が重なる実績。サイトに載せない実績も含める', () => {
    expect(projectsOfCareer(career, projects).map((p) => p.name)).toEqual([
      '同じ組織で重なる',
      '同じ組織で端の日だけ接する',
      'サイトに載せない',
    ]);
  });

  it('オーナー向けのスキルは、職歴の実績のスキルを重ねずに合わせる', () => {
    expect(skillsOfCareer(career, projects, 'owner')).toEqual([
      'TypeScript',
      'React',
      'Go',
      'Swift',
    ]);
  });

  it('訪問者向けのスキルは、サイトに載せる実績だけから求める', () => {
    expect(skillsOfCareer(career, projects, 'visitor')).toEqual(['TypeScript', 'React', 'Go']);
  });

  it('つながる実績が無ければ空', () => {
    expect(skillsOfCareer({ organizationId: 3, period: career.period }, projects, 'owner')).toEqual(
      [],
    );
  });
});
