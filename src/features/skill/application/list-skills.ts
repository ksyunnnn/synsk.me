import type { SkillSummary } from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import { countExperienceMonths } from '@/shared/domain/period';

/**
 * スキルの一覧と経験年数（FR-033・FR-034）。スキルとつないだ実績の期間を読み、経験年数を
 * 求める。求めた値は保存しない。`now` は終わりの日が空の実績を数える基準の時点
 */
export const listSkills = async (skills: SkillRepository, now: Date): Promise<SkillSummary[]> =>
  (await skills.listWithPeriods()).map(({ periods, ...skill }) => {
    const computedMonths = countExperienceMonths(periods, now);
    return { ...skill, computedMonths, experienceMonths: skill.monthsOverride ?? computedMonths };
  });
