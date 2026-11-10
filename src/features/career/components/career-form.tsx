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
import { InputField, SuggestingInputField, TextareaField } from '@/shared/components/field';
import { MaskingField } from '@/shared/components/masking-field';
import { SiteStatusField } from '@/shared/components/site-status-field';
import { FormActions } from '@/shared/components/form-actions';
import { SubmitButton } from '@/shared/components/submit-button';

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
  startedOn: {
    missing: '始まりの日を入力してください',
    invalid: '始まりの日を年月日で入力してください',
  },
  endedOn: {
    invalid: '終わりの日を年月日で入力してください',
    'ended-before-started': '終わりの日は始まりの日より前にできません',
  },
  description: {},
  url: { invalid: '関連 URL は http か https で始まる URL にしてください' },
};

const RESULT_MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict:
    'この職歴は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください',
} as const;

export const CareerForm = ({ action, initialValues, organizationNames, career }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
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
        <p role="alert" className="text-destructive">
          {RESULT_MESSAGES[result.status]}
        </p>
      )}
      <SiteStatusField status={values.status} />
      <MaskingField
        isMasked={values.isMasked}
        description="秘匿化すると、訪問者には秘匿化した組織名で出し、本文と画像を出しません"
      />
      <SuggestingInputField
        name="organizationName"
        label="組織名"
        hint="登録した組織から選ぶか、新しい組織名を入力します"
        options={organizationNames}
        defaultValue={values.organizationName}
        autoComplete="off"
        error={errorOf('organizationName')}
      />
      <InputField
        name="organizationNameMasked"
        label="秘匿化した組織名"
        hint="組織が秘匿化した組織名を持たないときだけ使います。持っている組織の値は変えません"
        defaultValue={values.organizationNameMasked}
        autoComplete="off"
        error={errorOf('organizationNameMasked')}
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
