'use client';

import { useActionState } from 'react';
import {
  INITIAL_DELETE_NOTE_FORM_STATE,
  NOTE_ID_FIELD,
  type DeleteNoteFormState,
  type NoteId,
} from '@/features/note/domain/note';

/**
 * note を削除する確認のフォーム。確認はダイアログにせず、このフォームを置いた画面で行う
 * （specs/005-note-write-and-read/research.md の R5）。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない
 * （ADR-0026 の依存の向き 3）。削除できたときは、Server Action が一覧の画面へ移す。
 */

type DeleteNoteFormAction = (
  state: DeleteNoteFormState,
  formData: FormData,
) => Promise<DeleteNoteFormState>;

type Props = {
  action: DeleteNoteFormAction;
  noteId: NoteId;
};

const RESULT_MESSAGES: Record<NonNullable<DeleteNoteFormState['result']>, string> = {
  'delete-failed': '削除に失敗しました。もう一度試してください',
  forbidden: '作り手であることを確かめられませんでした。ログインし直してください',
};

export const DeleteNoteForm = ({ action, noteId }: Props) => {
  const [{ result }, formAction] = useActionState(action, INITIAL_DELETE_NOTE_FORM_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name={NOTE_ID_FIELD} value={noteId} />
      {result !== null && <p role="alert">{RESULT_MESSAGES[result]}</p>}
      <button type="submit">削除する</button>
    </form>
  );
};
