'use client';

import { useActionState } from 'react';
import {
  EDUCATION_UID_FIELD,
  type EducationField,
  type EducationFieldError,
  type EducationFormResult,
  type EducationFormValues,
} from '@/features/education/domain/education';
import { InputField, TextareaField } from '@/shared/components/field';

/**
 * 学歴を登録する・編集するフォーム。Server Action は props で受け取り、`server/` を読み込まない
 * （ADR-0026 の依存の向き 3）。失敗の結果は、入力を消さずに理由を示す
 */

type Props = {
  action: (state: EducationFormResult | null, formData: FormData) => Promise<EducationFormResult>;
  initialValues: EducationFormValues;
  /** 編集する学歴の uid。持てば編集のフォーム */
  educationUid?: string;
};

const ERROR_MESSAGES: Record<EducationField, Partial<Record<EducationFieldError, string>>> = {
  school: { missing: '学校を入力してください' },
  department: {},
  startedOn: {
    missing: '始まりの日を入力してください',
    invalid: '始まりの日を年月日で入力してください',
  },
  endedOn: {
    invalid: '終わりの日を年月日で入力してください',
    'ended-before-started': '終わりの日は始まりの日より前にできません',
  },
  remarks: {},
};

export const EducationForm = ({ action, initialValues, educationUid }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: EducationField) => {
    const reason = errors[field];
    return reason ? ERROR_MESSAGES[field][reason] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {educationUid !== undefined && (
        <input type="hidden" name={EDUCATION_UID_FIELD} value={educationUid} />
      )}
      {result?.status === 'forbidden' && (
        <p role="alert" className="text-destructive">
          オーナーであることを確かめられませんでした。ログインし直してから入力し直してください
        </p>
      )}
      {result?.status === 'invalid' && (
        <p role="alert" className="text-destructive">
          入力を確かめてください
        </p>
      )}
      <InputField
        name="school"
        label="学校"
        defaultValue={values.school}
        autoComplete="off"
        error={errorOf('school')}
      />
      <InputField
        name="department"
        label="学部"
        hint="空にできます"
        defaultValue={values.department}
        autoComplete="off"
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
        hint="在学中なら空にします"
        defaultValue={values.endedOn}
        error={errorOf('endedOn')}
      />
      <TextareaField name="remarks" label="備考" rows={4} defaultValue={values.remarks} />
      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {educationUid === undefined ? '登録する' : '保存する'}
        </button>
      </div>
    </form>
  );
};
