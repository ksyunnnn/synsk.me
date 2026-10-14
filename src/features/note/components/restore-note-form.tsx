'use client';

import { useActionState } from 'react';
import {
  INITIAL_RESTORE_NOTE_FORM_STATE,
  NOTE_ID_FIELD,
  RESTORE_AS_FIELD,
  type NoteId,
  type RestoreNoteFormState,
} from '@/features/note/domain/note';

/**
 * 削除した note を戻す確認のフォーム。`DeleteNoteForm` と同じく、確認はこのフォームを
 * 置いた画面で行う（specs/005-note-write-and-read/research.md の R5）。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない
 * （ADR-0026 の依存の向き 3）。戻せたときは、Server Action が一覧の画面へ移す。
 *
 * 下書きで戻すか公開で戻すかを、押したボタン（`restoreAs`）で送る。公開で戻すボタンは、
 * 公開したことのある note にだけ置く（spec の FR-018）。
 */

type RestoreNoteFormAction = (
  state: RestoreNoteFormState,
  formData: FormData,
) => Promise<RestoreNoteFormState>;

type Props = {
  action: RestoreNoteFormAction;
  noteId: NoteId;
  hasBeenPublished: boolean;
};

const RESULT_MESSAGES: Record<NonNullable<RestoreNoteFormState['result']>, string> = {
  'restore-failed': '戻すのに失敗しました。もう一度試してください',
  forbidden: '作り手であることを確かめられませんでした。ログインし直してください',
};

export const RestoreNoteForm = ({ action, noteId, hasBeenPublished }: Props) => {
  const [{ result }, formAction] = useActionState(action, INITIAL_RESTORE_NOTE_FORM_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name={NOTE_ID_FIELD} value={noteId} />
      {result !== null && <p role="alert">{RESULT_MESSAGES[result]}</p>}
      {/* 訪問者に見える状態にしない「下書きで戻す」を先に置く */}
      <button type="submit" name={RESTORE_AS_FIELD} value="draft">
        下書きで戻す
      </button>
      {hasBeenPublished && (
        <button type="submit" name={RESTORE_AS_FIELD} value="published">
          公開で戻す
        </button>
      )}
    </form>
  );
};
