'use client';

import { useActionState } from 'react';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import type { ResumeStatus } from '@/features/resume/domain/resume';
import {
  OPENED_UPDATED_AT_FIELD,
  RESUME_ID_FIELD,
  STATUS_FIELD,
  type FieldError,
  type ResumeSettingsField,
} from '@/features/resume/domain/resume-forms';
import { InputField } from '@/shared/components/field';

/**
 * 職務経歴書の設定（題・期限）と、状態の切り替えのフォーム（specs/002-resume/contracts/dash.md の
 * `editResumeSettings`・`changeResumeStatus`）。限定公開用の識別子は読み取りだけで出す（FR-037）。
 * 期限の入力は plan.md の U9 の仮の形（日本時間の日付と時刻、空なら期限なし）
 */

type SettingsValues = Record<ResumeSettingsField, string>;
type SettingsResult = EditOutcome<SettingsValues, Partial<Record<ResumeSettingsField, FieldError>>>;
type StatusResult = EditOutcome<{ status: string }, { status?: FieldError }>;

const CONFLICT =
  'この職務経歴書は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください';
const FORBIDDEN =
  '作り手であることを確かめられませんでした。ログインし直してから入力し直してください';

const messageOf = (result: { status: string } | null) => {
  if (!result) return null;
  if (result.status === 'conflict') return CONFLICT;
  if (result.status === 'forbidden') return FORBIDDEN;
  if (result.status === 'invalid') return '入力を確かめてください';
  return null;
};

const BUTTON =
  'rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type Common = { resumeId: number; updatedAt: string };

const Hidden = ({ resumeId, updatedAt }: Common) => (
  <>
    <input type="hidden" name={RESUME_ID_FIELD} value={resumeId} />
    <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={updatedAt} />
  </>
);

export const ResumeSettingsForm = ({
  action,
  initialValues,
  slug,
  isLimited,
  ...common
}: Common & {
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
      <Hidden {...common} />
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
        <button type="submit" className={BUTTON}>
          保存する
        </button>
      </div>
    </form>
  );
};

export const ResumeStatusForm = ({
  action,
  status,
  ...common
}: Common & {
  action: (state: StatusResult | null, formData: FormData) => Promise<StatusResult>;
  status: ResumeStatus;
}) => {
  const [result, formAction] = useActionState(action, null);
  const message = messageOf(result);
  const next: ResumeStatus = status === 'draft' ? 'published' : 'draft';

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Hidden {...common} />
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <p>
        状態: <strong>{status === 'draft' ? '下書き' : '訪問者に見せる'}</strong>
      </p>
      <input type="hidden" name={STATUS_FIELD} value={next} />
      <div>
        <button type="submit" className={BUTTON}>
          {next === 'published' ? '訪問者に見せる' : '下書きに戻す'}
        </button>
      </div>
    </form>
  );
};
