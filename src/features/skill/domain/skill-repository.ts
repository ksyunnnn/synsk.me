import type { Skill, SkillId, SkillWithPeriods } from '@/features/skill/domain/skill';

/**
 * スキルの取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/skill/server/d1-skill-repository.ts にある
 */
export type SkillRepository = {
  /** スキルと、つないだ実績の期間。名前の順 */
  listWithPeriods: () => Promise<SkillWithPeriods[]>;
  findById: (id: SkillId) => Promise<Skill | null>;
  /** 大文字と小文字だけ違う名前のスキルがあれば登録しない（FR-031） */
  register: (
    content: Omit<Skill, 'id'>,
  ) => Promise<{ ok: true; id: SkillId } | { ok: false; reason: 'name-taken' }>;
  edit: (
    id: SkillId,
    content: Omit<Skill, 'id'>,
  ) => Promise<{ ok: true } | { ok: false; reason: 'name-taken' | 'not-found' }>;
  /** 実績とのつながりを先に消してから消す（research.md の R8） */
  delete: (id: SkillId) => Promise<{ ok: boolean }>;
  hasId: (id: SkillId) => Promise<boolean>;
};
