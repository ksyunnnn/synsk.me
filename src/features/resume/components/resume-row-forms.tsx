'use client';

import { useActionState, type ReactNode } from 'react';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import { MAX_COPIED_ROWS } from '@/features/resume/domain/build-resume';
import { RESUME_PROJECT_KINDS, RESUME_PROJECT_KIND_LABELS } from '@/features/resume/domain/resume';
import {
  OPENED_UPDATED_AT_FIELD,
  OVERRIDE_MONTHS_FIELD,
  OVERRIDE_NAME_FIELD,
  OVERRIDE_YEARS_FIELD,
  RESUME_UID_FIELD,
  ROW_UID_FIELD,
  type FieldError,
  type ResumeCareerFormValues,
  type ResumeEducationFormValues,
  type ResumeProjectFormValues,
  type SkillOverrideFormRow,
} from '@/features/resume/domain/resume-forms';
import { InputField, SelectField, TextareaField } from '@/shared/components/field';

/**
 * 職務経歴書の中で写した値を直すフォーム（specs/002-resume/contracts/dash.md の写した行の画面と
 * `/dash/resumes/{uid}/skills`）。秘匿化するかどうかの入力は出さない（FR-031）。直した値は
 * その職務経歴書にだけ効く（FR-032）。Server Action は props で受け取る（ADR-0026 の依存の向き 3）
 */

const MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict:
    'この職務経歴書は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください',
  'not-found': '直す行が見つかりませんでした',
} as const;

const FIELD_MESSAGES: Record<string, Partial<Record<FieldError, string>>> = {
  organizationName: { missing: '組織名を入力してください' },
  role: { missing: '肩書を入力してください' },
  kind: { invalid: '種類を選んでください' },
  title: { missing: '題を入力してください' },
  school: { missing: '学校を入力してください' },
  startedOn: {
    missing: '始まりの日を入力してください',
    invalid: '始まりの日を年月日で入力してください',
  },
  endedOn: {
    invalid: '終わりの日を年月日で入力してください',
    'ended-before-started': '終わりの日は始まりの日より前にできません',
  },
  url: { invalid: '関連 URL は http か https で始まる URL にしてください' },
  skills: { invalid: `スキルは ${MAX_COPIED_ROWS} 個までにしてください` },
};

type Target = { resumeUid: string; rowUid?: string; updatedAt: string };

type Action<V, E> = (
  state: EditOutcome<V, E> | null,
  formData: FormData,
) => Promise<EditOutcome<V, E>>;

/** 結果の知らせと、楽観ロックの値を持つフォームの枠 */
const useRowForm = <V extends object, E>(action: Action<V, E>, initialValues: V) => {
  const [result, formAction] = useActionState(action, null);
  const values = result && 'values' in result ? result.values : initialValues;
  const message = result && result.status !== 'saved' ? MESSAGES[result.status] : null;
  return { result, formAction, values, message };
};

const Frame = ({
  formAction,
  target,
  message,
  children,
}: {
  formAction: (formData: FormData) => void;
  target: Target;
  message: string | null;
  children: ReactNode;
}) => (
  <form action={formAction} className="flex flex-col gap-6">
    <input type="hidden" name={RESUME_UID_FIELD} value={target.resumeUid} />
    {target.rowUid !== undefined && (
      <input type="hidden" name={ROW_UID_FIELD} value={target.rowUid} />
    )}
    <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={target.updatedAt} />
    {message && (
      <p role="alert" className="text-destructive">
        {message}
      </p>
    )}
    {children}
    <div>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        保存する
      </button>
    </div>
  </form>
);

const errorText = (errors: Record<string, FieldError | undefined>, field: string) => {
  const reason = errors[field];
  return reason ? (FIELD_MESSAGES[field]?.[reason] ?? MESSAGES.invalid) : undefined;
};

const PeriodFields = ({
  values,
  errors,
  endedHint,
}: {
  values: { startedOn: string; endedOn: string };
  errors: Record<string, FieldError | undefined>;
  endedHint: string;
}) => (
  <>
    <InputField
      type="date"
      name="startedOn"
      label="始まりの日"
      defaultValue={values.startedOn}
      error={errorText(errors, 'startedOn')}
    />
    <InputField
      type="date"
      name="endedOn"
      label="終わりの日"
      hint={endedHint}
      defaultValue={values.endedOn}
      error={errorText(errors, 'endedOn')}
    />
  </>
);

type Errors = Partial<Record<string, FieldError>>;

export const ResumeCareerForm = ({
  action,
  initialValues,
  target,
}: {
  action: Action<ResumeCareerFormValues, Errors>;
  initialValues: ResumeCareerFormValues;
  target: Target;
}) => {
  const { result, formAction, values, message } = useRowForm(action, initialValues);
  const errors: Errors = result?.status === 'invalid' ? result.errors : {};
  return (
    <Frame formAction={formAction} target={target} message={message}>
      <InputField
        name="organizationName"
        label="組織名"
        defaultValue={values.organizationName}
        autoComplete="off"
        error={errorText(errors, 'organizationName')}
      />
      <InputField
        name="role"
        label="肩書"
        defaultValue={values.role}
        autoComplete="off"
        error={errorText(errors, 'role')}
      />
      <PeriodFields values={values} errors={errors} endedHint="所属が続いている職歴は空にします" />
      <TextareaField name="description" label="本文" rows={8} defaultValue={values.description} />
      <InputField
        inputMode="url"
        name="url"
        label="関連 URL"
        defaultValue={values.url}
        autoComplete="off"
        error={errorText(errors, 'url')}
      />
    </Frame>
  );
};

export const ResumeProjectForm = ({
  action,
  initialValues,
  target,
}: {
  action: Action<ResumeProjectFormValues, Errors>;
  initialValues: ResumeProjectFormValues;
  target: Target;
}) => {
  const { result, formAction, values, message } = useRowForm(action, initialValues);
  const errors: Errors = result?.status === 'invalid' ? result.errors : {};
  return (
    <Frame formAction={formAction} target={target} message={message}>
      <InputField
        name="organizationName"
        label="組織名"
        defaultValue={values.organizationName}
        autoComplete="off"
        error={errorText(errors, 'organizationName')}
      />
      <SelectField
        name="kind"
        label="種類"
        defaultValue={values.kind}
        error={errorText(errors, 'kind')}
      >
        {RESUME_PROJECT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {RESUME_PROJECT_KIND_LABELS[kind]}
          </option>
        ))}
      </SelectField>
      <InputField
        name="title"
        label="題"
        defaultValue={values.title}
        autoComplete="off"
        error={errorText(errors, 'title')}
      />
      <PeriodFields values={values} errors={errors} endedHint="続いている実績は空にします" />
      <TextareaField
        name="skills"
        label="スキル"
        hint="1 行に 1 つ書きます"
        rows={4}
        defaultValue={values.skills}
        error={errorText(errors, 'skills')}
      />
      <TextareaField name="description" label="本文" rows={8} defaultValue={values.description} />
      <InputField
        inputMode="url"
        name="url"
        label="関連 URL"
        defaultValue={values.url}
        autoComplete="off"
        error={errorText(errors, 'url')}
      />
    </Frame>
  );
};

export const ResumeEducationForm = ({
  action,
  initialValues,
  target,
}: {
  action: Action<ResumeEducationFormValues, Errors>;
  initialValues: ResumeEducationFormValues;
  target: Target;
}) => {
  const { result, formAction, values, message } = useRowForm(action, initialValues);
  const errors: Errors = result?.status === 'invalid' ? result.errors : {};
  return (
    <Frame formAction={formAction} target={target} message={message}>
      <InputField
        name="school"
        label="学校"
        defaultValue={values.school}
        autoComplete="off"
        error={errorText(errors, 'school')}
      />
      <InputField
        name="department"
        label="学部"
        defaultValue={values.department}
        autoComplete="off"
      />
      <PeriodFields values={values} errors={errors} endedHint="在学中は空にします" />
      <TextareaField name="remarks" label="備考" rows={4} defaultValue={values.remarks} />
    </Frame>
  );
};

export const ResumeSkillOverridesForm = ({
  action,
  initialRows,
  target,
}: {
  action: Action<SkillOverrideFormRow[], { invalidRows: number[] }>;
  initialRows: SkillOverrideFormRow[];
  target: Target;
}) => {
  const { result, formAction, values, message } = useRowForm(action, initialRows);
  const invalid = new Set(result?.status === 'invalid' ? result.errors.invalidRows : []);
  return (
    <Frame formAction={formAction} target={target} message={message}>
      {values.length === 0 ? (
        <p>写したスキルはありません</p>
      ) : (
        values.map((row, index) => (
          <fieldset key={row.name} className="flex flex-col gap-2">
            <legend className="font-bold">{row.name}</legend>
            <input type="hidden" name={OVERRIDE_NAME_FIELD} value={row.name} />
            <div className="grid grid-cols-2 gap-4">
              <InputField
                inputMode="numeric"
                name={OVERRIDE_YEARS_FIELD}
                label="年"
                defaultValue={row.years}
                autoComplete="off"
                error={invalid.has(index) ? '0 以上の整数にしてください' : undefined}
              />
              <InputField
                inputMode="numeric"
                name={OVERRIDE_MONTHS_FIELD}
                label="か月"
                hint="0〜11"
                defaultValue={row.months}
                autoComplete="off"
                error={invalid.has(index) ? '0〜11 の整数にしてください' : undefined}
              />
            </div>
          </fieldset>
        ))
      )}
    </Frame>
  );
};
