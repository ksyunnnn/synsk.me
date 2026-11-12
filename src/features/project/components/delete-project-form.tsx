'use client';

import { useActionState } from 'react';
import { PROJECT_UID_FIELD } from '@/features/project/domain/project';
import { FORBIDDEN_MESSAGE, FormAlert } from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * 実績を削除する確認のフォーム。確認はダイアログにせず、このフォームを置いた画面で行う
 * （specs/001-career-and-project/contracts/dash.md）。削除できたときは、Server Action が
 * 一覧の画面へ移す。このファイルは `server/` を読み込まない（ADR-0026 の依存の向き 3）
 */

type DeleteProjectAction = (
  state: { status: 'forbidden' } | null,
  formData: FormData,
) => Promise<{ status: 'forbidden' }>;

export const DeleteProjectForm = ({
  action,
  projectUid,
}: {
  action: DeleteProjectAction;
  projectUid: string;
}) => {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name={PROJECT_UID_FIELD} value={projectUid} />
      {result?.status === 'forbidden' && <FormAlert>{FORBIDDEN_MESSAGE}</FormAlert>}
      <div>
        <SubmitButton className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          削除する
        </SubmitButton>
      </div>
    </form>
  );
};
