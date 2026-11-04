import {
  parseSkillContent,
  type SkillFieldError,
  type SkillField,
  type SkillFormValues,
  type SkillId,
} from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { Author } from '@/shared/domain/author';

export type EditSkillOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<SkillField, SkillFieldError>>;
      values: SkillFormValues;
    };

/** スキルの名前と上書きの月数を直す（FR-031・FR-034）。作り手でなければ何も書かない（FR-040） */
export const editSkill = async (
  skills: SkillRepository,
  author: Author | null,
  id: SkillId,
  values: SkillFormValues,
): Promise<EditSkillOutcome> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseSkillContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const result = await skills.edit(id, parsed.content);
  if (result.ok) return { status: 'saved' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', errors: { name: 'name-taken' }, values };
};
