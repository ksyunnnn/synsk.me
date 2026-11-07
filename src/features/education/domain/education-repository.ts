import type {
  Education,
  EducationContent,
  EducationId,
} from '@/features/education/domain/education';

/**
 * 学歴の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/education/server/d1-education-repository.ts にある
 */
export type EducationRepository = {
  findById: (id: EducationId) => Promise<Education | null>;
  /** 始まりの日の新しい順 */
  list: () => Promise<Education[]>;
  register: (content: EducationContent) => Promise<EducationId>;
  edit: (id: EducationId, content: EducationContent) => Promise<{ ok: boolean }>;
  /** 写した職務経歴書の行は残し、指す id を空にしてから消す（research.md の R8） */
  delete: (id: EducationId) => Promise<{ ok: boolean }>;
  hasId: (id: EducationId) => Promise<boolean>;
};
