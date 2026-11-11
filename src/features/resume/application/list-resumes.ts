import type { Resume } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';

/** オーナーの職務経歴書の一覧。期限切れも含む（spec の Edge Cases） */
export const listResumes = (resumes: ResumeRepository): Promise<Resume[]> => resumes.list();
