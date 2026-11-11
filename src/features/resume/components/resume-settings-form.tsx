'use client';

import { useActionState } from 'react';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import {
  BUTTON,
  messageOf,
  ResumeFormHidden,
  type ResumeFormCommon,
} from '@/features/resume/components/resume-form-parts';
import type { FieldError, ResumeSettingsField } from '@/features/resume/domain/resume-forms';
import { InputField } from '@/shared/components/field';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * 職務経歴書の設定（題・期限）のフォーム（specs/002-resume/contracts/dash.md の
 * `editResumeSettings`）。限定公開用の識別子は読み取りだけで出す（FR-037）。
 * 期限の入力は plan.md の U9 の仮の形（日本時間の日付と時刻、空なら期限なし）。
 * 状態の切り替えは resume-status-form.tsx が持つ
 */

type SettingsValues = Record<ResumeSettingsField, string>;
type SettingsResult = EditOutcome<SettingsValues, Partial<Record<ResumeSettingsField, FieldError>>>;

export const ResumeSettingsForm = ({
  action,
  initialValues,
  slug,
  isLimited,
  ...common
}: ResumeFormCommon & {
  action: (state: SettingsResult | null, formData: FormData) => Promise<SettingsResult>;
  initialValues: SettingsValues;
  slug: string;
  isLimited: boolean;
}) => {
  const [result, formAction] = useActionState(action, null);
  const values =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const message = messageOf(result);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <ResumeFormHidden {...common} />
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <InputField
        name="title"
        label="題"
        hint="管理画面でだけ使います。訪問者には出しません"
        defaultValue={values.title}
        autoComplete="off"
        error={errors.title === 'missing' ? '題を入力してください' : undefined}
      />
      <InputField
        name="slug"
        label="識別子"
        hint={isLimited ? '限定公開用の識別子は書き換えられません' : undefined}
        readOnly
        defaultValue={slug}
      />
      {isLimited && (
        <InputField
          type="datetime-local"
          name="expires"
          label="期限"
          hint="日本時間。空なら期限を設けません。過ぎた期限を先の日時にすると、同じ URL でもう一度読めます"
          defaultValue={values.expires}
          error={errors.expires ? '期限を日付と時刻で入力してください' : undefined}
        />
      )}
      <div>
        <SubmitButton className={BUTTON}>保存する</SubmitButton>
      </div>
    </form>
  );
};
