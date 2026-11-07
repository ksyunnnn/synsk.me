import {
  parseSkillContent,
  type SkillFieldError,
  type SkillField,
  type SkillFormValues,
  type SkillId,
} from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { Author } from '@/shared/domain/author';

export type RegisterSkillOutcome =
  | { status: 'registered'; id: SkillId }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<SkillField, SkillFieldError>>;
      values: SkillFormValues;
    };

/** スキルを登録する（FR-031・FR-034）。作り手でなければ何も書かない（FR-040） */
export const registerSkill = async (
  skills: SkillRepository,
  author: Author | null,
  values: SkillFormValues,
): Promise<RegisterSkillOutcome> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseSkillContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const result = await skills.register(parsed.content);
  return result.ok
    ? { status: 'registered', id: result.id }
    : { status: 'invalid', errors: { name: 'name-taken' }, values };
};
