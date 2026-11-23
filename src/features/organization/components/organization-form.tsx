'use client';

import { useActionState } from 'react';
import {
  ORGANIZATION_UID_FIELD,
  type OrganizationField,
  type OrganizationFieldError,
  type OrganizationFormResult,
  type OrganizationFormValues,
} from '@/shared/domain/organization';
import { InputField } from '@/shared/components/field';
import { useDetailForm } from '@/shared/components/detail-sheet';
import { FormActions } from '@/shared/components/form-actions';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';
import { DraftConflict, useDraft } from '@/shared/components/drafts';
import { formStateOf } from '@/shared/domain/action-result';

/**
 * 組織名と秘匿化した組織名を直すフォーム。Server Action は props で受け取り、`server/` を
 * 読み込まない（ADR-0026 の依存の向き 3）。失敗の結果は、入力を消さずに理由を示す
 */

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

/** 項目の名前。直しかけと、別の画面で保存された値の違いを知らせるのに使う */
const LABELS = { name: '組織名', nameMasked: '秘匿化した組織名' };

export const OrganizationForm = ({
  action,
  organizationUid,
  initialValues,
  isReferencedByMasked,
}: Props) => {
  const [result, formAction, isPending] = useActionState(action, null);
  // 詳細のペインに置かれたら、保存のボタンをペインの上の行に任せる
  const detailForm = useDetailForm(isPending);
  // 保存せずに別の 1 件を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(`organization:${organizationUid ?? 'new'}`, initialValues, result, LABELS);
  const { values, errors } = formStateOf(result, draft.values);
  const errorOf = (field: OrganizationField) => {
    const reason = errors[field];
    return reason ? ERROR_MESSAGES[reason] : undefined;
  };

  return (
    <form
      key={draft.formKey}
      action={formAction}
      {...detailForm}
      className="flex flex-col gap-6"
      {...draft.bind}
    >
      <DraftConflict conflict={draft.conflict} noun="組織" />
      <input type="hidden" name={ORGANIZATION_UID_FIELD} value={organizationUid} />
      {result?.status === 'forbidden' && <FormAlert>{FORBIDDEN_INPUT_MESSAGE}</FormAlert>}
      {result?.status === 'invalid' && <FormAlert>{INVALID_INPUT_MESSAGE}</FormAlert>}
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
      {!detailForm && (
        <FormActions>
          <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            保存する
          </SubmitButton>
        </FormActions>
      )}
    </form>
  );
};
