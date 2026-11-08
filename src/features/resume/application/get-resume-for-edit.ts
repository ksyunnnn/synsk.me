import type { ResumeForEdit, ResumeId } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';

/** オーナーが編集する職務経歴書と、写した中身。無い id なら null */
export const getResumeForEdit = (
  resumes: ResumeRepository,
  id: ResumeId,
): Promise<ResumeForEdit | null> => resumes.findForEdit(id);
