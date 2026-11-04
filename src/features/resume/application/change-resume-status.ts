import { isResumeStatus, type EditTimes, type ResumeId } from '@/features/resume/domain/resume';
import type { FieldError } from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import { toEditOutcome, type EditOutcome } from './edit-outcome';

/** 下書きか、訪問者に見せるかを切り替える（FR-021）。作り手でなければ何も書かない（FR-033） */
export const changeResumeStatus = async (
  resumes: ResumeRepository,
  author: Author | null,
  id: ResumeId,
  status: string,
  times: EditTimes,
): Promise<EditOutcome<{ status: string }, { status?: FieldError }>> => {
  if (!author) return { status: 'forbidden' };
  if (!isResumeStatus(status)) {
    return { status: 'invalid', errors: { status: 'invalid' }, values: { status } };
  }
  return toEditOutcome(await resumes.changeStatus(id, status, times), { status });
};
