'use client';

import { useActionState } from 'react';
import {
  INITIAL_RESTORE_NOTE_FORM_STATE,
  NOTE_ID_FIELD,
  type NoteId,
  type RestoreNoteFormState,
} from '@/features/note/domain/note';

/**
 * 削除した note を戻す確認のフォーム。`DeleteNoteForm` と同じく、確認はこのフォームを
 * 置いた画面で行う（specs/005-note-write-and-read/research.md の R5）。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない
 * （ADR-0026 の依存の向き 3）。戻せたときは、Server Action が一覧の画面へ移す。
 */

type RestoreNoteFormAction = (
  state: RestoreNoteFormState,
  formData: FormData,
) => Promise<RestoreNoteFormState>;

type Props = {
  action: RestoreNoteFormAction;
  noteId: NoteId;
};

const RESULT_MESSAGES: Record<NonNullable<RestoreNoteFormState['result']>, string> = {
  'restore-failed': '戻すのに失敗しました。もう一度試してください',
  forbidden: '作り手であることを確かめられませんでした。ログインし直してください',
};

export const RestoreNoteForm = ({ action, noteId }: Props) => {
  const [{ result }, formAction] = useActionState(action, INITIAL_RESTORE_NOTE_FORM_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name={NOTE_ID_FIELD} value={noteId} />
      {result !== null && <p role="alert">{RESULT_MESSAGES[result]}</p>}
      <button type="submit">戻す</button>
    </form>
  );
};
