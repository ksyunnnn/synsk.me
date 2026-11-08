'use client';

import { useActionState } from 'react';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import {
  BUTTON,
  messageOf,
  ResumeFormHidden,
  type ResumeFormCommon,
} from '@/features/resume/components/resume-form-parts';
import type {
  ResumeSettingsError,
  ResumeSettingsField,
} from '@/features/resume/domain/resume-forms';
import { InputField } from '@/shared/components/field';

/**
 * 職務経歴書の設定（題・期限・公開用の識別子）のフォーム（specs/002-resume/contracts/dash.md の
 * `editResumeSettings`）。限定公開用の識別子は読み取りだけで出す（FR-037）。公開用の識別子は
 * 書き換えられる（FR-039）。公開用は期限を持たない。
 * 期限の入力は plan.md の U9 の仮の形（日本時間の日付と時刻、空なら期限なし）。
 * 状態の切り替えは resume-status-form.tsx が持つ
 */

type SettingsValues = Record<ResumeSettingsField, string>;
type SettingsResult = EditOutcome<
  SettingsValues,
  Partial<Record<ResumeSettingsField, ResumeSettingsError>>
>;

const SLUG_ERRORS: Record<ResumeSettingsError, string> = {
  missing: '識別子を入力してください',
  invalid: '識別子は 100 文字までの英小文字・数字・ハイフンで入力してください',
  'ended-before-started': '識別子を確かめてください',
  taken: 'この識別子は別の職務経歴書が使っています',
};

export const ResumeSettingsForm = ({
  action,
  initialValues,
  isLimited,
  ...common
}: ResumeFormCommon & {
  action: (state: SettingsResult | null, formData: FormData) => Promise<SettingsResult>;
  initialValues: SettingsValues;
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
      {isLimited ? (
        <InputField
          name="slug"
          label="識別子"
          hint="限定公開用の識別子は書き換えられません"
          readOnly
          defaultValue={initialValues.slug}
        />
      ) : (
        <InputField
          name="slug"
          label="識別子"
          hint="URL の /resume/ の後に付きます。英小文字・数字・ハイフンで、例: resume"
          defaultValue={values.slug}
          autoComplete="off"
          error={errors.slug ? SLUG_ERRORS[errors.slug] : undefined}
        />
      )}
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
        <button type="submit" className={BUTTON}>
          保存する
        </button>
      </div>
    </form>
  );
};
