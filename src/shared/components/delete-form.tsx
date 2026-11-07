'use client';

import { useActionState } from 'react';

/**
 * 行を削除する確認のフォーム。確認はダイアログにせず、このフォームを置いた画面で行う
 * （specs/001-career-and-project/contracts/dash.md）。消せたときは Server Action が別の画面へ
 * 移す。消せなかったときは、Server Action が返した理由の文言を出す。
 * 使い手は 001 のスキル・職歴・学歴の削除の画面
 */

type Result = { status: string };

type Props<R extends Result> = {
  action: (state: R | null, formData: FormData) => Promise<R>;
  /** 削除する行の id を送る名前 */
  idField: string;
  id: number;
  messages: Record<R['status'], string>;
};

export const DeleteForm = <R extends Result>({ action, idField, id, messages }: Props<R>) => {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name={idField} value={id} />
      {result && (
        <p role="alert" className="text-destructive">
          {messages[result.status as R['status']]}
        </p>
      )}
      <div>
        <button
          type="submit"
          className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          削除する
        </button>
      </div>
    </form>
  );
};
