import type { ResumeSources } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';

/** 作成の画面の選択肢。すべての職歴・実績・学歴（FR-005） */
export const listResumeSources = (resumes: ResumeRepository): Promise<ResumeSources> =>
  resumes.readSources('all');
