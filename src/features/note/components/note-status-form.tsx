'use client';

import { useActionState } from 'react';
import {
  NOTE_STATUS_LABELS,
  NOTE_UID_FIELD,
  type NoteFormResult,
  type NoteStatus,
} from '@/features/note/domain/note';

/**
 * note の公開と下書きに戻すの操作（specs/003-note/contracts/dash.md）。開いたときの版は送らず、
 * その時点の最も新しい版を公開する（FR-011、plan.md の U6）。Server Action は props で受け取る
 */

type StatusAction = (state: NoteFormResult | null, formData: FormData) => Promise<NoteFormResult>;

type Props = {
  noteUid: string;
  status: NoteStatus;
  publishAction: StatusAction;
  unpublishAction: StatusAction;
};

const MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  untitled: '題が空の版は公開できません。題を入力して保存してから公開してください',
  failed: '状態を変えられませんでした',
} as const;

const BUTTON =
  'rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const messageOf = (result: NoteFormResult | null) => {
  if (!result || result.status === 'saved') return null;
  if (result.status === 'forbidden') return MESSAGES.forbidden;
  if (result.status === 'invalid' && result.errors.title === 'missing') return MESSAGES.untitled;
  return MESSAGES.failed;
};

export const NoteStatusForm = ({ noteUid, status, publishAction, unpublishAction }: Props) => {
  const [publishResult, publish] = useActionState(publishAction, null);
  const [unpublishResult, unpublish] = useActionState(unpublishAction, null);
  const message = messageOf(publishResult) ?? messageOf(unpublishResult);

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
      <div className="flex flex-wrap gap-3">
        <form action={publish}>
          <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
          <button type="submit" className={BUTTON}>
            {status === 'published' ? '最も新しい版で公開し直す' : '最も新しい版を公開する'}
          </button>
        </form>
        {status === 'published' && (
          <form action={unpublish}>
            <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
            <button type="submit" className={BUTTON}>
              下書きに戻す
            </button>
          </form>
        )}
      </div>
    </section>
  );
};
