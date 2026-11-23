'use client';

import { useActionState, type ReactNode } from 'react';
import type { EditOutcome } from '@/features/resume/domain/edit-outcome';
import { MAX_COPIED_ROWS } from '@/features/resume/domain/build-resume';
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
import { InputField, TextareaField } from '@/shared/components/field';
import { DraftConflict, useDraft } from '@/shared/components/drafts';
import { FormGroup } from '@/shared/components/form-group';
import { KindField } from '@/shared/components/kind-field';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { PERIOD_FIELD_MESSAGES } from '@/shared/components/period-field-messages';
import { useDetailForm } from '@/shared/components/detail-sheet';
import { FormActions } from '@/shared/components/form-actions';
import { SubmitButton } from '@/shared/components/submit-button';
import { TokenField } from '@/shared/components/token-field';
import { ReturnQueryField } from '@/shared/components/return-query-field';

/**
 * 職務経歴書の中で写した値を直すフォーム（specs/002-resume/contracts/dash.md の写した行の画面と
 * `/dash/resumes/{uid}/skills`）。秘匿化するかどうかの入力は出さない（FR-031）。直した値は
 * その職務経歴書にだけ効く（FR-032）。Server Action は props で受け取る（ADR-0026 の依存の向き 3）
 */

const MESSAGES = {
  forbidden: FORBIDDEN_INPUT_MESSAGE,
  invalid: INVALID_INPUT_MESSAGE,
  conflict:
    'この職務経歴書は、開いた後に別の画面で保存されていました。保存していません。保存された内容を読み直します',
  'not-found': '直す行が見つかりませんでした',
} as const;

const FIELD_MESSAGES: Record<string, Partial<Record<FieldError, string>>> = {
  organizationName: { missing: '組織名を入力してください' },
  role: { missing: '肩書を入力してください' },
  kind: { invalid: '種類を選んでください' },
  title: { missing: '題を入力してください' },
  school: { missing: '学校を入力してください' },
  ...PERIOD_FIELD_MESSAGES,
  url: { invalid: '関連 URL は http か https で始まる URL にしてください' },
  skills: { invalid: `スキルは ${MAX_COPIED_ROWS} 個までにしてください` },
};

type Target = { resumeUid: string; rowUid?: string; updatedAt: string };

type Action<V, E> = (
  state: EditOutcome<V, E> | null,
  formData: FormData,
) => Promise<EditOutcome<V, E>>;

/** 結果の知らせと、楽観ロックの値を持つフォームの枠 */
const useRowForm = <V extends object, E>(
  action: Action<V, E>,
  initialValues: V,
  /** 直しかけを残す鍵と、違う項目を知らせるための項目の名前。無ければ残さない */
  drafting?: { key: string; labels: Record<string, string> },
) => {
  const [result, formAction, isPending] = useActionState(action, null);
  // 保存せずに別の 1 行を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(
    drafting?.key ?? '',
    initialValues as Record<string, string>,
    result,
    drafting?.labels ?? {},
  );
  const initial = drafting ? (draft.values as V) : initialValues;
  const values = result && 'values' in result ? result.values : initial;
  const message = result && result.status !== 'saved' ? MESSAGES[result.status] : null;
  return { result, formAction, isPending, values, message, draft: drafting ? draft : undefined };
};

const Frame = ({
  formAction,
  target,
  message,
  draft,
  isPending,
  children,
}: {
  formAction: (formData: FormData) => void;
  target: Target;
  message: string | null;
  draft?: ReturnType<typeof useDraft>;
  isPending: boolean;
  children: ReactNode;
}) => {
  // 詳細のペインに置かれたら、保存のボタンをペインの上の行に任せる。元の行の詳細と形をそろえる
  // （#366 の明文化）
  const detailForm = useDetailForm(isPending);
  return (
    <form
      key={draft?.formKey}
      {...detailForm}
      action={formAction}
      className="flex flex-col gap-8"
      {...draft?.bind}
    >
      {draft && <DraftConflict conflict={draft.conflict} noun="職務経歴書の行" />}
      <input type="hidden" name={RESUME_UID_FIELD} value={target.resumeUid} />
      {target.rowUid !== undefined && (
        <>
          <input type="hidden" name={ROW_UID_FIELD} value={target.rowUid} />
          <ReturnQueryField />
        </>
      )}
      <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={target.updatedAt} />
      {message && <FormAlert>{message}</FormAlert>}
      {children}
      {!detailForm && (
        <FormActions>
          <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            保存する
          </SubmitButton>
        </FormActions>
      )}
    </form>
  );
};

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
  <div className="grid gap-4 sm:grid-cols-2">
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
      defaultValue={values.endedOn}
      error={errorText(errors, 'endedOn')}
    />
    <p className="text-caption text-muted-foreground sm:col-span-2">終わりの日は、{endedHint}</p>
  </div>
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
  const { result, formAction, isPending, values, message, draft } = useRowForm(
    action,
    initialValues,
    {
      key: `resume-career:${target.rowUid ?? 'new'}`,
      labels: {
        organizationName: '組織名',
        role: '肩書',
        startedOn: '始まりの日',
        endedOn: '終わりの日',
        description: '本文',
        url: '関連 URL',
      },
    },
  );
  const errors: Errors = result?.status === 'invalid' ? result.errors : {};
  return (
    <Frame
      formAction={formAction}
      target={target}
      message={message}
      draft={draft}
      isPending={isPending}
    >
      <FormGroup title="どこで">
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
      </FormGroup>
      <FormGroup title="いつ">
        <PeriodFields values={values} errors={errors} endedHint="所属が続いているなら空にします" />
      </FormGroup>
      <FormGroup title="中身">
        <TextareaField name="description" label="本文" rows={8} defaultValue={values.description} />
        <InputField
          inputMode="url"
          name="url"
          label="関連 URL"
          defaultValue={values.url}
          autoComplete="off"
          error={errorText(errors, 'url')}
        />
      </FormGroup>
    </Frame>
  );
};

export const ResumeProjectForm = ({
  action,
  initialValues,
  target,
  skillNames,
}: {
  action: Action<ResumeProjectFormValues, Errors>;
  initialValues: ResumeProjectFormValues;
  target: Target;
  /** 候補に出す、登録したスキルの名前。写したスキルは名前で持つので、候補にない名前も足せる */
  skillNames: string[];
}) => {
  const { result, formAction, isPending, values, message, draft } = useRowForm(
    action,
    initialValues,
    {
      key: `resume-project:${target.rowUid ?? 'new'}`,
      labels: {
        organizationName: '組織名',
        kind: '種類',
        title: '題',
        startedOn: '始まりの日',
        endedOn: '終わりの日',
        description: '本文',
        url: '関連 URL',
        skills: '使ったスキル',
      },
    },
  );
  const errors: Errors = result?.status === 'invalid' ? result.errors : {};
  // 元の実績のフォームと、まとまりと部品をそろえる（#366 の明文化）
  return (
    <Frame
      formAction={formAction}
      target={target}
      message={message}
      draft={draft}
      isPending={isPending}
    >
      <FormGroup title="何を">
        <KindField value={values.kind} error={errorText(errors, 'kind')} />
        <InputField
          name="title"
          label="題"
          defaultValue={values.title}
          autoComplete="off"
          error={errorText(errors, 'title')}
        />
        <InputField
          name="organizationName"
          label="組織名"
          defaultValue={values.organizationName}
          autoComplete="off"
          error={errorText(errors, 'organizationName')}
        />
      </FormGroup>
      <FormGroup title="いつ">
        <PeriodFields values={values} errors={errors} endedHint="続いているなら空にします" />
      </FormGroup>
      <FormGroup title="中身">
        <TextareaField name="description" label="本文" rows={8} defaultValue={values.description} />
        <InputField
          inputMode="url"
          name="url"
          label="関連 URL"
          defaultValue={values.url}
          autoComplete="off"
          error={errorText(errors, 'url')}
        />
        <TokenField
          name="skills"
          label="使ったスキル"
          hint="この職務経歴書にだけ効きます。候補にない名前も足せます"
          options={skillNames.map((skillName) => ({ value: skillName, label: skillName }))}
          defaultValue={values.skills.split('\n').filter((skill) => skill.trim() !== '')}
          serialize="lines"
          allowCustom
          empty="名前を打つと足せます"
          error={errorText(errors, 'skills')}
        />
      </FormGroup>
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
  const { result, formAction, isPending, values, message, draft } = useRowForm(
    action,
    initialValues,
    {
      key: `resume-education:${target.rowUid ?? 'new'}`,
      labels: {
        school: '学校',
        department: '学部',
        startedOn: '始まりの日',
        endedOn: '終わりの日',
        remarks: '備考',
      },
    },
  );
  const errors: Errors = result?.status === 'invalid' ? result.errors : {};
  return (
    <Frame
      formAction={formAction}
      target={target}
      message={message}
      draft={draft}
      isPending={isPending}
    >
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
  const { result, formAction, isPending, values, message } = useRowForm(action, initialRows);
  const invalid = new Set(result?.status === 'invalid' ? result.errors.invalidRows : []);
  return (
    <Frame formAction={formAction} target={target} message={message} isPending={isPending}>
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
                label="か月（0〜11）"
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
