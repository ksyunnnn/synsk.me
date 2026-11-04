'use client';

import { useActionState } from 'react';
import {
  SELECTION_FIELDS,
  type CreateResumeError,
  type CreateResumeField,
  type CreateResumeFormResult,
} from '@/features/resume/domain/resume-forms';
import { CheckboxField, InputField } from '@/shared/components/field';
import { TextLink } from '@/shared/components/text-link';

/**
 * 職務経歴書を作るフォーム（specs/002-resume/contracts/dash.md の `/dash/resumes/new`）。
 * 職歴・実績・学歴のチェックボックスは、すべて選んだ状態で始まる（FR-005・SC-006）。
 * Server Action は props で受け取り、`server/` を読み込まない（ADR-0026 の依存の向き 3）。
 *
 * 公開用の選択肢は tasks.md の Phase 7（US5）の T068 で足すまで出さず、限定公開用で作る。
 * 作れたら、鍵を含む URL をこの画面にだけ示す（research.md の R5）
 */

export type SourceOption = { id: number; label: string; detail: string };

type Props = {
  action: (
    state: CreateResumeFormResult | null,
    formData: FormData,
  ) => Promise<CreateResumeFormResult>;
  careers: SourceOption[];
  projects: SourceOption[];
  educations: SourceOption[];
};

const ERROR_MESSAGES: Record<CreateResumeField, Partial<Record<CreateResumeError, string>>> = {
  title: { missing: '題を入力してください' },
  audience: {
    invalid: '限定公開用か公開用かを選んでください',
    'public-not-supported': '公開用はまだ作れません',
  },
  expires: { invalid: '期限を日付と時刻で入力してください' },
  selection: {
    invalid: '選んだ項目を読めませんでした。開き直してください',
    'source-missing':
      '選んだ職歴・実績・学歴のうち、開いた後に消えたものがあります。開き直してください',
  },
};

const RESULT_MESSAGES = {
  forbidden: '作り手であることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
} as const;

const SourceFieldset = ({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: SourceOption[];
  /** 送り直した値。無ければすべて選ぶ */
  selected: string[] | null;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="font-bold">{legend}</legend>
    {options.length === 0 ? (
      <p className="text-sm text-muted-foreground">登録したものはありません</p>
    ) : (
      options.map((option) => (
        <CheckboxField
          key={option.id}
          name={name}
          value={option.id}
          label={option.label}
          hint={option.detail}
          defaultChecked={selected === null || selected.includes(String(option.id))}
        />
      ))
    )}
  </fieldset>
);

export const ResumeCreateForm = ({ action, careers, projects, educations }: Props) => {
  const [result, formAction] = useActionState(action, null);

  if (result?.status === 'created') {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">職務経歴書を作りました。状態は下書きです</p>
        {result.url && (
          <>
            <InputField
              name="limitedUrl"
              label="限定公開用の URL"
              hint="この URL はこの画面でだけ示します。あとから示せないため、控えてから移ってください"
              readOnly
              defaultValue={result.url}
            />
          </>
        )}
        <p>
          <TextLink href={`/dash/resumes/${result.id}`}>設定の画面へ</TextLink>
        </p>
      </div>
    );
  }

  const values = result?.status === 'invalid' ? result.values : null;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: CreateResumeField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {result && (
        <p role="alert" className="text-destructive">
          {RESULT_MESSAGES[result.status]}
        </p>
      )}
      <InputField
        name="title"
        label="題"
        hint="管理画面でだけ使います。訪問者には出しません"
        defaultValue={values?.title ?? ''}
        autoComplete="off"
        error={errorOf('title')}
      />
      <input type="hidden" name="audience" value="limited" />
      <p className="text-sm text-muted-foreground">
        限定公開用で作ります。限定公開用か公開用かは、作った後に変えられません
        {errorOf('audience') && <span className="text-destructive">。{errorOf('audience')}</span>}
      </p>
      <InputField
        type="datetime-local"
        name="expires"
        label="期限"
        hint="日本時間。空なら期限を設けません"
        defaultValue={values?.expires ?? ''}
        error={errorOf('expires')}
      />
      {errorOf('selection') && <p className="text-sm text-destructive">{errorOf('selection')}</p>}
      <SourceFieldset
        legend="職歴"
        name={SELECTION_FIELDS.careerIds}
        options={careers}
        selected={values?.careerIds ?? null}
      />
      <SourceFieldset
        legend="実績"
        name={SELECTION_FIELDS.projectIds}
        options={projects}
        selected={values?.projectIds ?? null}
      />
      <SourceFieldset
        legend="学歴"
        name={SELECTION_FIELDS.educationIds}
        options={educations}
        selected={values?.educationIds ?? null}
      />
      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          作る
        </button>
      </div>
    </form>
  );
};
