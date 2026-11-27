import type { SkillId } from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { Author } from '@/shared/domain/author';

export type DeleteSkillOutcome =
  | { status: 'deleted' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'has-children' };

/**
 * スキルを消す（FR-031）。子のスキルを持つ親のスキルは消さない。オーナーでなければ何も書かない
 * （FR-040）
 */
export const deleteSkill = async (
  skills: SkillRepository,
  author: Author | null,
  id: SkillId,
): Promise<DeleteSkillOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await skills.delete(id);
  return result.ok ? { status: 'deleted' } : { status: result.reason };
};
