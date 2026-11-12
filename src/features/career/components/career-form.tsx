'use client';

import { useActionState } from 'react';
import {
  CAREER_UID_FIELD,
  OPENED_UPDATED_AT_FIELD,
  type CareerField,
  type CareerFieldError,
  type CareerFormResult,
  type CareerFormValues,
} from '@/features/career/domain/career';
import { InputField, TextareaField } from '@/shared/components/field';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { MaskingField } from '@/shared/components/masking-field';
import { OrganizationNameFields } from '@/shared/components/organization-name-fields';
import { PERIOD_FIELD_MESSAGES } from '@/shared/components/period-field-messages';
import { SiteStatusField } from '@/shared/components/site-status-field';
import { FormActions } from '@/shared/components/form-actions';
import { SubmitButton } from '@/shared/components/submit-button';
import { formStateOf } from '@/shared/domain/action-result';

/**
 * 職歴を登録する・編集するフォーム（specs/001-career-and-project/contracts/dash.md）。
 * Server Action は props で受け取り、`server/` を読み込まない（ADR-0026 の依存の向き 3）。
 * 失敗の結果は送られた値を持ち、入力を消さずに理由を示す。組織名は、登録した組織の名前を選択肢に
 * 出す、ネイティブの `<datalist>` の入力（plan.md の U3）
 */

type Props = {
  action: (state: CareerFormResult | null, formData: FormData) => Promise<CareerFormResult>;
  initialValues: CareerFormValues;
  /** 組織名の選択肢。登録した組織の名前（FR-002） */
  organizationNames: string[];
  /** 編集する職歴。持てば編集のフォームで、楽観ロックの値を送る */
  career?: { uid: string; updatedAt: string };
};

const ERROR_MESSAGES: Record<CareerField, Partial<Record<CareerFieldError, string>>> = {
  organizationName: { missing: '組織名を入力してください' },
  organizationNameMasked: {
    'masked-name-required':
      '秘匿化するには、組織の秘匿化した組織名が要ります。秘匿化した組織名を入力してください',
  },
  role: { missing: '肩書を入力してください' },
  isMasked: {},
  status: {},
  ...PERIOD_FIELD_MESSAGES,
  description: {},
  url: { invalid: '関連 URL は http か https で始まる URL にしてください' },
};

const RESULT_MESSAGES = {
  forbidden: FORBIDDEN_INPUT_MESSAGE,
  invalid: INVALID_INPUT_MESSAGE,
  conflict:
    'この職歴は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください',
} as const;

export const CareerForm = ({ action, initialValues, organizationNames, career }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const { values, errors } = formStateOf(result, initialValues);
  const errorOf = (field: CareerField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {career && (
        <>
          <input type="hidden" name={CAREER_UID_FIELD} value={career.uid} />
          <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={career.updatedAt} />
        </>
      )}
      {result && result.status !== 'saved' && (
        <FormAlert>{RESULT_MESSAGES[result.status]}</FormAlert>
      )}
      <SiteStatusField status={values.status} />
      <MaskingField
        isMasked={values.isMasked}
        description="秘匿化すると、訪問者には秘匿化した組織名で出し、本文と画像を出しません"
      />
      <OrganizationNameFields
        organizationNames={organizationNames}
        organizationName={values.organizationName}
        organizationNameMasked={values.organizationNameMasked}
        errorOf={errorOf}
      />
      <InputField
        name="role"
        label="肩書"
        defaultValue={values.role}
        autoComplete="off"
        error={errorOf('role')}
      />
      <InputField
        type="date"
        name="startedOn"
        label="始まりの日"
        defaultValue={values.startedOn}
        error={errorOf('startedOn')}
      />
      <InputField
        type="date"
        name="endedOn"
        label="終わりの日"
        hint="所属が続いている職歴は空にします"
        defaultValue={values.endedOn}
        error={errorOf('endedOn')}
      />
      <TextareaField
        name="description"
        label="本文"
        rows={8}
        defaultValue={values.description}
        error={errorOf('description')}
      />
      <InputField
        inputMode="url"
        name="url"
        label="関連 URL"
        defaultValue={values.url}
        autoComplete="off"
        error={errorOf('url')}
      />
      <FormActions>
        <SubmitButton className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {career ? '保存する' : '登録する'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
