import type { EditResult } from '@/features/resume/domain/resume-repository';

/**
 * 職務経歴書の中の書き込みのユースケースが返す結果（specs/002-resume/contracts/dash.md）。
 * 先に書き換えられていたら、送られた値を持って `conflict` を返す（FR-038）
 */
export type EditOutcome<Values, Errors> =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; errors: Errors; values: Values }
  | { status: 'conflict'; values: Values };

export const toEditOutcome = <Values, Errors>(
  result: EditResult,
  values: Values,
): EditOutcome<Values, Errors> => {
  if (result.ok) return { status: 'saved' };
  return result.reason === 'conflict' ? { status: 'conflict', values } : { status: 'not-found' };
};
