'use client';

import { useActionState } from 'react';
import {
  NOTE_UID_FIELD,
  OPENED_REVISION_UID_FIELD,
  REVISION_UID_FIELD,
  type RevertNoteResult,
} from '@/features/note/domain/note';

/**
 * 過去の版に戻すフォーム（FR-009、specs/003-note/contracts/dash.md）。開いたときの最も新しい版の
 * uid を送り、開いた後に別の画面で保存されていれば戻さない（FR-020）。Server Action は props で
 * 受け取る
 */

type RevertAction = (
  state: RevertNoteResult | null,
  formData: FormData,
) => Promise<RevertNoteResult>;

type Props = {
  action: RevertAction;
  noteUid: string;
  revisionUid: string;
  openedRevisionUid: string;
};

const MESSAGES: Record<RevertNoteResult['status'], string> = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  conflict:
    'この note は、開いた後に別の画面で保存されていました。戻していません。開き直してから戻してください',
};

export const NoteRevertForm = ({ action, noteUid, revisionUid, openedRevisionUid }: Props) => {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
      <input type="hidden" name={REVISION_UID_FIELD} value={revisionUid} />
      <input type="hidden" name={OPENED_REVISION_UID_FIELD} value={openedRevisionUid} />
      {result && (
        <p role="alert" className="text-destructive">
          {MESSAGES[result.status]}
        </p>
      )}
      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          この版に戻す
        </button>
      </div>
    </form>
  );
};
