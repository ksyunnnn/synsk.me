'use client';

import { useActionState } from 'react';
import {
  ACTIVITY_UID_FIELD,
  type ActivityField,
  type ActivityFieldError,
  type ActivityFormResult,
  type ActivityFormValues,
} from '@/features/activity/domain/activity';
import { REGISTERED_SOURCES, SOURCE_LABELS, intakeModeOf } from '@/features/activity/domain/source';
import { InputField, SelectField } from '@/shared/components/field';

/**
 * URL を指名して、または手で入力して外部の activity を登録する・書き換えるフォーム
 * （specs/004-external-activity/contracts/dash.md）。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない（ADR-0026 の
 * 依存の向き 3）。入力の決まりはサーバで確かめ、誤りを文言で返す。`required` を付けない
 * （001 の入力と同じ）
 */

type ActivityFormAction = (
  state: ActivityFormResult | null,
  formData: FormData,
) => Promise<ActivityFormResult>;

type Props = {
  action: ActivityFormAction;
  initialValues: ActivityFormValues;
  /**
   * 書き換える activity。持てば書き換えのフォームで、取得元を選ばず、書き換えられる項目
   * （`editable`）だけを入力にする
   */
  activity?: { uid: string; editable: readonly ActivityField[] };
};

const ERROR_MESSAGES: Record<ActivityField, Partial<Record<ActivityFieldError, string>>> = {
  source: {
    invalid: '取得元を選んでください',
    'not-editable': '一覧を取る取得元の activity は書き換えられません',
  },
  url: {
    missing: 'URL を入力してください',
    'url-mismatch': 'この取得元の URL を入力してください',
    duplicate: 'この URL の activity は、もう登録されています',
    'fetch-failed':
      '取得元から題を取れませんでした。URL が公開されているかを確かめてから、入力し直してください',
  },
  title: { missing: '題を入力してください' },
  publishedOn: {
    missing: '日付を入力してください',
    invalid: '日付を年月日で入力してください',
  },
};

const RESULT_MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict: '入力を確かめてください',
} as const;

export const ActivityForm = ({ action, initialValues, activity }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values: ActivityFormValues =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: ActivityField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };
  const isEditable = (field: ActivityField) => !activity || activity.editable.includes(field);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {activity && <input type="hidden" name={ACTIVITY_UID_FIELD} value={activity.uid} />}

      {result && result.status !== 'saved' && (
        <p role="alert" className="text-destructive">
          {RESULT_MESSAGES[result.status]}
        </p>
      )}
      {errorOf('source') && activity && (
        <p className="text-sm text-destructive">{errorOf('source')}</p>
      )}

      {!activity && (
        // 送った後、React はフォームを初めの値に戻す。選択肢は送った値で描き直し、選び直させない
        <SelectField
          key={values.source}
          name="source"
          label="取得元"
          hint="URL を指名する取得元は、題を取得元から取ります。手で入力する取得元は、題も入力します"
          defaultValue={values.source}
          error={errorOf('source')}
        >
          {REGISTERED_SOURCES.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source]}（
              {intakeModeOf(source) === 'url' ? 'URL を指名する' : '手で入力する'}）
            </option>
          ))}
        </SelectField>
      )}

      {isEditable('url') && (
        <InputField
          inputMode="url"
          name="url"
          label="URL"
          defaultValue={values.url}
          autoComplete="off"
          error={errorOf('url')}
        />
      )}
      {isEditable('title') && (
        <InputField
          name="title"
          label="題"
          hint={
            activity
              ? undefined
              : '手で入力する取得元（CodePen・登録していないサイト）のときだけ使います'
          }
          defaultValue={values.title}
          autoComplete="off"
          error={errorOf('title')}
        />
      )}
      <InputField
        type="date"
        name="publishedOn"
        label="日付"
        hint="一覧に並べる日です。取得元が公開日を返さないため、ここで入れた日を使います"
        defaultValue={values.publishedOn}
        error={errorOf('publishedOn')}
      />

      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {activity ? '保存する' : '登録する'}
        </button>
      </div>
    </form>
  );
};
