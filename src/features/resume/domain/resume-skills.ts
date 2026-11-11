import type { ResumeProject, ResumeSkillOverride } from '@/features/resume/domain/resume';
import { countExperienceMonths } from '@/shared/domain/period';

/**
 * 職務経歴書のスキルの一覧と経験年数（specs/002-resume/spec.md の FR-026〜FR-028、research.md の
 * R12）。写したスキルの名前を集め、同じ名前を 1 つにまとめる。経験年数は、その名前を持つ写した
 * 実績の期間から 001 の FR-033 の数え方で求め、写した上書きがあればそれを使う。求めた値は保存しない。
 *
 * 「同じ名前」の比べ方は plan.md の U11 で決まっていない。決まるまでの仮の形として、文字列が
 * 完全に一致するものを同じ名前とする（写した `skill_name` の列と同じく、大文字と小文字を区別する）
 */

export type ResumeSkill = {
  name: string;
  /** 経験の月数。年と月で表すのは表示の側（001 の `toYearsAndMonths`） */
  months: number;
};

/** 並びは経験の長い順。同じ長さは名前の順（spec は並びを決めない。仮の形） */
export const listResumeSkills = (
  projects: readonly Pick<ResumeProject, 'skills' | 'period'>[],
  overrides: readonly ResumeSkillOverride[],
  now: Date,
): ResumeSkill[] => {
  const periodsByName = new Map<string, ResumeProject['period'][]>();
  for (const project of projects) {
    for (const name of new Set(project.skills)) {
      const periods = periodsByName.get(name) ?? [];
      periods.push(project.period);
      periodsByName.set(name, periods);
    }
  }
  const overrideByName = new Map(overrides.map((o) => [o.skillName, o.months]));
  return [...periodsByName]
    .map(([name, periods]) => ({
      name,
      months: overrideByName.get(name) ?? countExperienceMonths(periods, now),
    }))
    .sort((a, b) => b.months - a.months || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
};
