'use client';

import { useActionState } from 'react';
import { ORGANIZATION_UID_FIELD } from '@/features/organization/application/edit-organization';

/** 組織を消す確認のフォーム。消せなければ理由を示す */

type Result = { status: 'forbidden' | 'referenced' | 'personal' };

const MESSAGES: Record<Result['status'], string> = {
  forbidden: '作り手であることを確かめられませんでした。ログインし直してください',
  referenced: '職歴か実績がこの組織を指しているため、消せません',
  personal: '個人の組織は消せません',
};

export const DeleteOrganizationForm = ({
  action,
  organizationUid,
}: {
  action: (state: Result | null, formData: FormData) => Promise<Result>;
  organizationUid: string;
}) => {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name={ORGANIZATION_UID_FIELD} value={organizationUid} />
      {result && (
        <p role="alert" className="text-destructive">
          {MESSAGES[result.status]}
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
