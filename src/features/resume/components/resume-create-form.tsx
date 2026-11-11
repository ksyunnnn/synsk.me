'use client';

import { useActionState } from 'react';
import {
  SELECTION_FIELDS,
  type CreateResumeError,
  type CreateResumeField,
  type CreateResumeFormResult,
} from '@/features/resume/domain/resume-forms';
import {
  ResumeStatusFields,
  useResumeStatus,
} from '@/features/resume/components/resume-status-form';
import type { ResumeAudience, ResumeStatus } from '@/features/resume/domain/resume';
import {
  SELECTION_MESSAGES,
  SourceFieldset,
  type SourceOption,
} from '@/features/resume/components/resume-source-fieldset';
import { InputField } from '@/shared/components/field';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';
import { FormActions } from '@/shared/components/form-actions';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * 職務経歴書を作るフォーム（specs/002-resume/contracts/dash.md の `/dash/resumes/new`）。
 * 職歴・実績・学歴のチェックボックスは、すべて選んだ状態で始まる（FR-005・SC-006）。
 * Server Action は props で受け取り、`server/` を読み込まない（ADR-0026 の依存の向き 3）。
 *
 * 公開用の選択肢は tasks.md の Phase 7（US5）の T068 で足すまで出さず、限定公開用で作る。
 * 作れたら、限定公開用の URL をこの画面に示す。設定の画面も同じ URL を示す（FR-040）。作った
 * 職務経歴書は下書きで、下書きの間は URL が 404 になるため、URL の隣に状態の切り替えを置く
 */

type Props = {
  action: (
    state: CreateResumeFormResult | null,
    formData: FormData,
  ) => Promise<CreateResumeFormResult>;
  /** 作った後の状態の切り替え。移らずに同じ画面に留まり、URL を示したままにする */
  changeStatusAction: Parameters<typeof useResumeStatus>[0];
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
  selection: SELECTION_MESSAGES,
};

const RESULT_MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
} as const;

const AUDIENCE_LABELS: Record<ResumeAudience, string> = {
  limited: '限定公開用',
  public: '公開用',
};

const createdNotice = (audience: ResumeAudience, status: ResumeStatus) =>
  `${AUDIENCE_LABELS[audience]}の職務経歴書を作りました。${status === 'draft' ? '非公開です' : '公開中です'}`;

/** 作った後の画面。知らせと状態の切り替えは、同じ状態（`useResumeStatus`）から描く */
const ResumeCreated = ({
  created,
  changeStatusAction,
}: {
  created: Extract<CreateResumeFormResult, { status: 'created' }>;
  changeStatusAction: Props['changeStatusAction'];
}) => {
  const statusState = useResumeStatus(changeStatusAction, 'draft', created.updatedAt);

  return (
    <div className="flex flex-col gap-4">
      <p role="status">{createdNotice(created.audience, statusState.status)}</p>
      {created.url && (
        <>
          <InputField
            name="limitedUrl"
            label="限定公開用の URL"
            hint="設定の画面でも示します"
            readOnly
            defaultValue={created.url}
          />
          <ResumeStatusFields
            state={statusState}
            draftNote="公開すると開けます"
            resumeUid={created.uid}
          />
        </>
      )}
      <p>
        <TextLink href={routes.dash.resumes.row(created.uid)}>設定の画面へ</TextLink>
      </p>
    </div>
  );
};

export const ResumeCreateForm = ({
  action,
  changeStatusAction,
  careers,
  projects,
  educations,
}: Props) => {
  const [result, formAction] = useActionState(action, null);

  if (result?.status === 'created') {
    return <ResumeCreated created={result} changeStatusAction={changeStatusAction} />;
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
      <FormActions>
        <SubmitButton className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          作る
        </SubmitButton>
      </FormActions>
    </form>
  );
};
