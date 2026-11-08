'use client';

import { useActionState } from 'react';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import type { ResumeStatus } from '@/features/resume/domain/resume';
import { STATUS_FIELD, type FieldError } from '@/features/resume/domain/resume-forms';
import {
  BUTTON,
  messageOf,
  ResumeFormHidden,
  type ResumeFormCommon,
} from '@/features/resume/components/resume-form-parts';

/**
 * 公開するか、非公開にするかを切り替えるフォーム（specs/002-resume/contracts/dash.md の
 * `changeResumeStatus`）。設定の画面と作成の画面が使う。
 *
 * 設定の画面の Server Action は保存したら画面を移す。作成の画面の Server Action は移らずに
 * `changed` を返し、このフォームが切り替えた後の状態と更新日時で描き直す
 */

type StatusResult =
  | EditOutcome<{ status: string }, { status?: FieldError }>
  | { status: 'changed'; resumeStatus: ResumeStatus; updatedAt: string };

type StatusAction = (state: StatusResult | null, formData: FormData) => Promise<StatusResult>;

/**
 * 切り替えの状態。作成の画面は、フォームの外の知らせもこの状態から描く
 * （知らせとフォームの状態の表示を食い違わせないため）
 */
export const useResumeStatus = (
  action: StatusAction,
  initialStatus: ResumeStatus,
  initialUpdatedAt: string,
) => {
  const [result, formAction] = useActionState(action, null);
  const changed = result?.status === 'changed' ? result : null;
  return {
    formAction,
    message: messageOf(result),
    status: changed?.resumeStatus ?? initialStatus,
    updatedAt: changed?.updatedAt ?? initialUpdatedAt,
  };
};

export type ResumeStatusState = ReturnType<typeof useResumeStatus>;

/** `useResumeStatus` の状態を描くフォーム */
export const ResumeStatusFields = ({
  state: { formAction, message, status, updatedAt },
  draftNote,
  resumeUid,
}: {
  state: ResumeStatusState;
  /** 非公開の間だけ、状態に添える短い文 */
  draftNote?: string;
  resumeUid: string;
}) => {
  const next: ResumeStatus = status === 'draft' ? 'published' : 'draft';

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ResumeFormHidden resumeUid={resumeUid} updatedAt={updatedAt} />
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <p className="flex flex-wrap items-baseline gap-x-2">
        <strong>{status === 'draft' ? '非公開' : '公開中'}</strong>
        {status === 'draft' && draftNote && (
          <span className="text-sm text-muted-foreground">{draftNote}</span>
        )}
      </p>
      <input type="hidden" name={STATUS_FIELD} value={next} />
      <div>
        <button type="submit" className={BUTTON}>
          {next === 'published' ? '公開する' : '非公開にする'}
        </button>
      </div>
    </form>
  );
};

export const ResumeStatusForm = ({
  action,
  status,
  draftNote,
  resumeUid,
  updatedAt,
}: ResumeFormCommon & {
  action: StatusAction;
  status: ResumeStatus;
  /** 非公開の間だけ、状態に添える短い文 */
  draftNote?: string;
}) => {
  const state = useResumeStatus(action, status, updatedAt);
  return <ResumeStatusFields state={state} draftNote={draftNote} resumeUid={resumeUid} />;
};
