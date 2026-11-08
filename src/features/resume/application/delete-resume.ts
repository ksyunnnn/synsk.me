import type { ResumeId } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';

/**
 * 職務経歴書を物理削除する（REQUIREMENTS.md の FR-11）。写し元は消さない。オーナーでなければ
 * 何も書かない（FR-033）
 */
export const deleteResume = async (
  resumes: ResumeRepository,
  author: Author | null,
  id: ResumeId,
): Promise<{ status: 'deleted' | 'forbidden' | 'not-found' }> => {
  if (!author) return { status: 'forbidden' };
  return { status: (await resumes.delete(id)).ok ? 'deleted' : 'not-found' };
};
