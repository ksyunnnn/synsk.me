'use client';

import { useActionState } from 'react';
import {
  NOTE_STATUS_LABELS,
  NOTE_UID_FIELD,
  type NoteFormResult,
  type NoteStatus,
} from '@/features/note/domain/note';

/**
 * note の公開の操作（specs/003-note/contracts/dash.md）。開いたときの版は送らず、その時点の最も
 * 新しい版を公開する（FR-011、plan.md の U6）。Server Action は props で受け取る
 */

type StatusAction = (state: NoteFormResult | null, formData: FormData) => Promise<NoteFormResult>;

type Props = {
  noteUid: string;
  status: NoteStatus;
  publishAction: StatusAction;
};

const MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  untitled: '題が空の版は公開できません。題を入力して保存してから公開してください',
  failed: '公開できませんでした',
} as const;

const BUTTON =
  'rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const NoteStatusForm = ({ noteUid, status, publishAction }: Props) => {
  const [publishResult, publish] = useActionState(publishAction, null);

  const message = (() => {
    if (!publishResult || publishResult.status === 'saved') return null;
    if (publishResult.status === 'forbidden') return MESSAGES.forbidden;
    if (publishResult.status === 'invalid' && publishResult.errors.title === 'missing')
      return MESSAGES.untitled;
    return MESSAGES.failed;
  })();

  return (
    <section aria-labelledby="note-status-heading" className="flex flex-col gap-3">
      <h2 id="note-status-heading" className="text-lg font-bold">
        状態: {NOTE_STATUS_LABELS[status]}
      </h2>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <form action={publish}>
        <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
        <button type="submit" className={BUTTON}>
          {status === 'published' ? '最も新しい版で公開し直す' : '最も新しい版を公開する'}
        </button>
      </form>
    </section>
  );
};
