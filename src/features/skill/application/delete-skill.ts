import type { SkillId } from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { Author } from '@/shared/domain/author';

/** スキルを消す（FR-031）。作り手でなければ何も書かない（FR-040） */
export const deleteSkill = async (
  skills: SkillRepository,
  author: Author | null,
  id: SkillId,
): Promise<{ status: 'deleted' | 'forbidden' | 'not-found' }> => {
  if (!author) return { status: 'forbidden' };
  return { status: (await skills.delete(id)).ok ? 'deleted' : 'not-found' };
};
