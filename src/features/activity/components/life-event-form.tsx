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

/**
 * life event を作る・書き換えるフォーム（specs/004-external-activity/contracts/dash.md）。
 * リンク先を入れる項目を持たない（FR-024）。Server Action は props で受け取る
 */

type LifeEventFormAction = (
  state: LifeEventFormResult | null,
  formData: FormData,
) => Promise<LifeEventFormResult>;

type Props = {
  action: LifeEventFormAction;
  initialValues: LifeEventFormValues;
  /** 書き換える life event。持てば書き換えのフォームで、識別子の入力を出す */
  lifeEvent?: { uid: string };
};

const ERROR_MESSAGES: Record<LifeEventField, Partial<Record<LifeEventFieldError, string>>> = {
  title: { missing: '題を入力してください' },
  description: {},
  happenedOn: {
    missing: '起きた日を入力してください',
    invalid: '起きた日を年月日で入力してください',
  },
  slug: {
    missing: '識別子を入力してください',
    invalid: '識別子は英小文字・数字・ハイフンで、100 文字までにしてください',
    'slug-taken': 'この識別子はほかの life event が使っています',
  },
};

const RESULT_MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict: '入力を確かめてください',
} as const;

export const LifeEventForm = ({ action, initialValues, lifeEvent }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values: LifeEventFormValues =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: LifeEventField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {lifeEvent && <input type="hidden" name={LIFE_EVENT_UID_FIELD} value={lifeEvent.uid} />}

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
        hint="日の分からない出来事は、その月の 1 日などの便宜的な日を入れます"
        defaultValue={values.happenedOn}
        error={errorOf('happenedOn')}
      />
      <TextareaField
        name="description"
        label="説明"
        hint="書式を持たない文章です。空行で段落を分けます"
        rows={6}
        defaultValue={values.description}
        error={errorOf('description')}
      />
      {lifeEvent && (
        <InputField
          name="slug"
          label="識別子"
          hint="URL に出ます。英小文字・数字・ハイフンで、100 文字まで"
          defaultValue={values.slug}
          autoComplete="off"
          error={errorOf('slug')}
        />
      )}

      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {lifeEvent ? '保存する' : '作成する'}
        </button>
      </div>
    </form>
  );
};
