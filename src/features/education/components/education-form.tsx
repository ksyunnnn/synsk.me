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
import { FormActions } from '@/shared/components/form-actions';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { PERIOD_FIELD_MESSAGES } from '@/shared/components/period-field-messages';
import { SubmitButton } from '@/shared/components/submit-button';
import { DraftConflict, useDraft } from '@/shared/components/drafts';
import { formStateOf } from '@/shared/domain/action-result';

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
  ...PERIOD_FIELD_MESSAGES,
  remarks: {},
};

/** 項目の名前。直しかけと、別の画面で保存された値の違いを知らせるのに使う */
const LABELS = {
  school: '学校',
  department: '学部',
  startedOn: '始まりの日',
  endedOn: '終わりの日',
  remarks: '備考',
};

export const EducationForm = ({ action, initialValues, educationUid }: Props) => {
  const [result, formAction] = useActionState(action, null);
  // 保存せずに別の 1 件を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(`education:${educationUid ?? 'new'}`, initialValues, result, LABELS);
  const { values, errors } = formStateOf(result, draft.values);
  const errorOf = (field: EducationField) => {
    const reason = errors[field];
    return reason ? ERROR_MESSAGES[field][reason] : undefined;
  };

  return (
    <form key={draft.formKey} action={formAction} className="flex flex-col gap-6" {...draft.bind}>
      <DraftConflict conflict={draft.conflict} noun="学歴" />
      {educationUid !== undefined && (
        <input type="hidden" name={EDUCATION_UID_FIELD} value={educationUid} />
      )}
      {result?.status === 'forbidden' && <FormAlert>{FORBIDDEN_INPUT_MESSAGE}</FormAlert>}
      {result?.status === 'invalid' && <FormAlert>{INVALID_INPUT_MESSAGE}</FormAlert>}
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
      <FormActions>
        <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {educationUid === undefined ? '登録する' : '保存する'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
