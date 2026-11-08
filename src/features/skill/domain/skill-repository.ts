import type { Skill, SkillContent, SkillId, SkillWithPeriods } from '@/features/skill/domain/skill';
import type { Uid } from '@/shared/domain/uid';

/**
 * スキルの取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/skill/server/d1-skill-repository.ts にある
 */
export type SkillRepository = {
  /**
   * スキルと、つないだ実績の期間。名前の順。`published` はサイトに載せる実績の期間だけを読み、
   * サイトで訪問者に出す経験年数に使う。`all` はすべての実績の期間を読み、管理画面に使う
   * （specs/001-career-and-project/spec.md の FR-033）
   */
  listWithPeriods: (projects: 'all' | 'published') => Promise<SkillWithPeriods[]>;
  findById: (id: SkillId) => Promise<Skill | null>;
  /** 管理画面の URL とフォームの uid が指すスキルの id。無ければ null */
  findIdByUid: (uid: Uid) => Promise<SkillId | null>;
  /** 大文字と小文字だけ違う名前のスキルがあれば登録しない（FR-031） */
  register: (
    content: SkillContent,
  ) => Promise<{ ok: true; id: SkillId; uid: Uid } | { ok: false; reason: 'name-taken' }>;
  edit: (
    id: SkillId,
    content: SkillContent,
  ) => Promise<{ ok: true } | { ok: false; reason: 'name-taken' | 'not-found' }>;
  /** 実績とのつながりを先に消してから消す（research.md の R8） */
  delete: (id: SkillId) => Promise<{ ok: boolean }>;
  hasId: (id: SkillId) => Promise<boolean>;
};
