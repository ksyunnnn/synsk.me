'use client';

import { useActionState } from 'react';
import {
  LIFE_EVENT_UID_FIELD,
  type LifeEventField,
  type LifeEventFieldError,
  type LifeEventFormResult,
  type LifeEventFormValues,
} from '@/features/activity/domain/life-event';
import { InputField, TextareaField } from '@/shared/components/field';
import { FormActions } from '@/shared/components/form-actions';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * life event を作る・書き換えるフォーム（specs/004-external-activity/contracts/dash.md）。
 * Server Action は props で受け取り、`server/` を読み込まない（ADR-0026 の依存の向き 3）。
 * リンク先の入力を持たない（FR-024）。保存していない入力は持たない（contracts/dash.md）。
 *
 * 入力の決まり（題と起きた日は必須。FR-024・FR-025）はサーバで確かめ、誤りを文言で返す。
 * `required` を付けない。実績のフォーム（src/features/project/components/project-form.tsx）と同じで、
 * ブラウザが送信を止めると、どの項目の何が合わないかを同じ形で伝えられないため
 */

type Props = {
  action: (state: LifeEventFormResult | null, formData: FormData) => Promise<LifeEventFormResult>;
  initialValues: LifeEventFormValues;
  /** 書き換える life event の uid。持てば編集のフォーム */
  uid?: string;
};

const ERROR_MESSAGES: Record<LifeEventField, Partial<Record<LifeEventFieldError, string>>> = {
  title: { missing: '題を入力してください' },
  description: {},
  happenedOn: {
    missing: '起きた日を入力してください',
    invalid: '起きた日を年月日で入力してください',
  },
  slug: {
    invalid: '識別子は 1〜100 文字の英小文字・数字・ハイフンにしてください',
    'slug-taken': 'この識別子はほかの life event が使っています。別の識別子にしてください',
  },
};

const RESULT_MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict: '保存していません。開き直してから入力し直してください',
} as const;

export const LifeEventForm = ({ action, initialValues, uid }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: LifeEventField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {uid && <input type="hidden" name={LIFE_EVENT_UID_FIELD} value={uid} />}
      {result && result.status !== 'saved' && (
        <p role="alert" className="text-destructive">
          {RESULT_MESSAGES[result.status]}
        </p>
      )}
      <InputField
        name="title"
        label="題"
        defaultValue={values.title}
        autoComplete="off"
        error={errorOf('title')}
      />
      <InputField
        type="date"
        name="happenedOn"
        label="起きた日"
        defaultValue={values.happenedOn}
        error={errorOf('happenedOn')}
      />
      <TextareaField
        name="description"
        label="説明"
        rows={8}
        defaultValue={values.description}
        error={errorOf('description')}
      />
      <InputField
        name="slug"
        label="識別子"
        hint={
          uid
            ? 'ページの URL（/life-events/識別子）に使います。空にすると今の識別子のままです'
            : 'ページの URL（/life-events/識別子）に使います。空にすると、推測できない値を入れます'
        }
        defaultValue={values.slug}
        autoComplete="off"
        error={errorOf('slug')}
      />
      <FormActions>
        <SubmitButton className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {uid ? '保存する' : '作る'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
