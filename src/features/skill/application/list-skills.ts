import { experiencePeriodsBySkill, type SkillSummary } from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import { countExperienceMonths } from '@/shared/domain/period';

/**
 * 管理画面のスキルの一覧と経験年数（FR-033・FR-034）。スキルとつないだ実績の期間を読み、
 * 経験年数を求める。親は、親か子のどれかをつないだ実績の期間から求める。管理画面はすべての
 * 実績を載せるため、サイトに載せない実績の期間も数える。
 * 求めた値は保存しない。`now` は終わりの日が空の実績を数える基準の時点
 */
export const listSkills = async (skills: SkillRepository, now: Date): Promise<SkillSummary[]> => {
  const rows = await skills.listWithPeriods('all');
  const periodsBySkill = experiencePeriodsBySkill(rows);
  return rows.map(({ id, uid, name, monthsOverride, parentId }) => {
    const computedMonths = countExperienceMonths(periodsBySkill.get(id) ?? [], now);
    return {
      id,
      uid,
      name,
      monthsOverride,
      parentId,
      computedMonths,
      experienceMonths: monthsOverride ?? computedMonths,
    };
  });
};
