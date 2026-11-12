'use client';

import { useActionState } from 'react';
import {
  EXTERNAL_ACTIVITY_UID_FIELD,
  OWNED_SOURCE_LABELS,
  type ExternalActivityField,
  type ExternalActivityFieldError,
  type ExternalActivityFormResult,
  type ExternalActivityFormValues,
} from '@/features/activity/domain/external-activity';
import { OWNED_SOURCES, type OwnedSourceName } from '@/features/activity/domain/sources';
import { InputField, SelectField } from '@/shared/components/field';
import { FormActions } from '@/shared/components/form-actions';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';
import { formStateOf } from '@/shared/domain/action-result';

/**
 * URL を指名した・手で入力した外部の activity を登録する・書き換えるフォーム
 * （specs/004-external-activity/contracts/dash.md）。Server Action は props で受け取り、`server/` を
 * 読み込まない（ADR-0026 の依存の向き 3）。保存していない入力は持たない
 * （contracts/dash.md）。入力の決まりはサーバで確かめ、`required` を付けない
 * （life event のフォームと同じ理由）。
 *
 * 編集では取得元を変えない。URL を指名する取得元の URL と題は取得元が決めたので、日付だけを入れる
 */

type Props = {
  action: (
    state: ExternalActivityFormResult | null,
    formData: FormData,
  ) => Promise<ExternalActivityFormResult>;
  initialValues: ExternalActivityFormValues;
  /** 書き換える activity の uid と取得元。持てば編集のフォーム */
  editing?: { uid: string; source: OwnedSourceName; isManual: boolean };
};

const ERROR_MESSAGES: Record<
  ExternalActivityField,
  Partial<Record<ExternalActivityFieldError, string>>
> = {
  source: { missing: '取得元を選んでください', invalid: '一覧の取得元から選んでください' },
  url: {
    missing: 'URL を入力してください',
    invalid: 'http か https の URL を入力してください',
    'wrong-host': '選んだ取得元の URL を入力してください',
    'url-taken': 'この URL は登録してあります',
    'fetch-failed': '取得元から題を取れませんでした。時間をおいて登録し直してください',
  },
  title: {
    missing: '題を入力してください',
    'title-unavailable': '取得元から題を取れませんでした。題を入力してください',
  },
  publishedOn: {
    missing: '日付を入力してください',
    invalid: '日付を年月日で入力してください',
  },
};

const RESULT_MESSAGES = {
  forbidden: FORBIDDEN_INPUT_MESSAGE,
  invalid: INVALID_INPUT_MESSAGE,
  conflict: '保存していません。開き直してから入力し直してください',
} as const;

export const ExternalActivityForm = ({ action, initialValues, editing }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const { values, errors } = formStateOf(result, initialValues);
  const errorOf = (field: ExternalActivityField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };
  const editsLink = !editing || editing.isManual;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {editing && <input type="hidden" name={EXTERNAL_ACTIVITY_UID_FIELD} value={editing.uid} />}
      {result && result.status !== 'saved' && (
        <FormAlert>{RESULT_MESSAGES[result.status]}</FormAlert>
      )}
      {editing ? (
        <p>取得元: {OWNED_SOURCE_LABELS[editing.source]}</p>
      ) : (
        <SelectField
          name="source"
          label="取得元"
          defaultValue={values.source}
          error={errorOf('source')}
        >
          <option value="">選んでください</option>
          {OWNED_SOURCES.map((source) => (
            <option key={source} value={source}>
              {OWNED_SOURCE_LABELS[source]}
            </option>
          ))}
        </SelectField>
      )}
      {editsLink ? (
        <>
          <InputField
            type="url"
            name="url"
            label="URL"
            defaultValue={values.url}
            autoComplete="off"
            error={errorOf('url')}
          />
          <InputField
            name="title"
            label="題"
            hint={
              editing
                ? undefined
                : 'CodePen と登録していないサイトでは必須です。ほかの取得元では、取得元から題を取れないときに使います'
            }
            defaultValue={values.title}
            autoComplete="off"
            error={errorOf('title')}
          />
        </>
      ) : (
        <p>
          {values.title}・{values.url}
        </p>
      )}
      <InputField
        type="date"
        name="publishedOn"
        label="日付"
        hint="一覧に並べる日付です"
        defaultValue={values.publishedOn}
        error={errorOf('publishedOn')}
      />
      <FormActions>
        <SubmitButton className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {editing ? '保存する' : '登録する'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
