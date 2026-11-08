'use client';

import { useActionState } from 'react';
import {
  ORGANIZATION_UID_FIELD,
  type OrganizationField,
  type OrganizationFieldError,
  type OrganizationFormValues,
} from '@/features/organization/application/edit-organization';
import type { ActionResult } from '@/shared/domain/action-result';
import { InputField } from '@/shared/components/field';

/**
 * 組織名と秘匿化した組織名を直すフォーム。Server Action は props で受け取り、`server/` を
 * 読み込まない（ADR-0026 の依存の向き 3）。失敗の結果は、入力を消さずに理由を示す
 */

type OrganizationFormResult = ActionResult<OrganizationField, OrganizationFieldError>;

type Props = {
  action: (
    state: OrganizationFormResult | null,
    formData: FormData,
  ) => Promise<OrganizationFormResult>;
  organizationUid: string;
  initialValues: OrganizationFormValues;
  /** 秘匿化した職歴・実績が指している。秘匿化した組織名を空にできないことを示す */
  isReferencedByMasked: boolean;
};

const ERROR_MESSAGES: Record<OrganizationFieldError, string> = {
  missing: '組織名を入力してください',
  'name-taken': 'この組織名の組織はほかにあります',
  'masked-name-required':
    '秘匿化した職歴・実績がこの組織を指しているため、秘匿化した組織名を空にできません',
};

export const OrganizationForm = ({
  action,
  organizationUid,
  initialValues,
  isReferencedByMasked,
}: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: OrganizationField) => {
    const reason = errors[field];
    return reason ? ERROR_MESSAGES[reason] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name={ORGANIZATION_UID_FIELD} value={organizationUid} />
      {result?.status === 'forbidden' && (
        <p role="alert" className="text-destructive">
          作り手であることを確かめられませんでした。ログインし直してから入力し直してください
        </p>
      )}
      {result?.status === 'invalid' && (
        <p role="alert" className="text-destructive">
          入力を確かめてください
        </p>
      )}
      <InputField
        name="name"
        label="組織名"
        hint="直すと、この組織を指す職歴と実績の表示が変わります。作った職務経歴書の中身は変わりません"
        defaultValue={values.name}
        autoComplete="off"
        error={errorOf('name')}
      />
      <InputField
        name="nameMasked"
        label="秘匿化した組織名"
        hint={
          isReferencedByMasked
            ? '秘匿化した職歴・実績がこの組織を指しているため、空にできません'
            : '空にできます。空の組織を指す職歴・実績は秘匿化できません'
        }
        defaultValue={values.nameMasked}
        autoComplete="off"
        error={errorOf('nameMasked')}
      />
      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          保存する
        </button>
      </div>
    </form>
  );
};
