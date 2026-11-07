import { OPENED_UPDATED_AT_FIELD, RESUME_ID_FIELD } from '@/features/resume/domain/resume-forms';

/** 職務経歴書の中を書き換えるフォームが共有する部品と文言（specs/002-resume/contracts/dash.md） */

const CONFLICT =
  'この職務経歴書は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください';
const FORBIDDEN =
  '作り手であることを確かめられませんでした。ログインし直してから入力し直してください';

export const messageOf = (result: { status: string } | null) => {
  if (!result) return null;
  if (result.status === 'conflict') return CONFLICT;
  if (result.status === 'forbidden') return FORBIDDEN;
  if (result.status === 'invalid') return '入力を確かめてください';
  return null;
};

export const BUTTON =
  'rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** 書き換える職務経歴書と、開いたときの更新日時（楽観ロック。research.md の R8） */
export type ResumeFormCommon = { resumeId: number; updatedAt: string };

export const ResumeFormHidden = ({ resumeId, updatedAt }: ResumeFormCommon) => (
  <>
    <input type="hidden" name={RESUME_ID_FIELD} value={resumeId} />
    <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={updatedAt} />
  </>
);
