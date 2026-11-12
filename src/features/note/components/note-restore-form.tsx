'use client';

import { useActionState } from 'react';
import { NOTE_UID_FIELD } from '@/features/note/domain/note';
import { FORBIDDEN_MESSAGE, FormAlert } from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * 削除した note を元に戻すフォーム（specs/003-note/contracts/dash.md）。削除した note の画面に
 * これだけを置く。戻せたときは Server Action が編集の画面へ移す
 */

type RestoreAction = (
  state: { status: 'forbidden' } | null,
  formData: FormData,
) => Promise<{ status: 'forbidden' }>;

export const NoteRestoreForm = ({
  action,
  noteUid,
}: {
  action: RestoreAction;
  noteUid: string;
}) => {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
      {result?.status === 'forbidden' && <FormAlert>{FORBIDDEN_MESSAGE}</FormAlert>}
      <div>
        <SubmitButton className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          元に戻す
        </SubmitButton>
      </div>
    </form>
  );
};
