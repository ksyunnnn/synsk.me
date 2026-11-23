'use client';

import { useActionState } from 'react';
import {
  CAREER_UID_FIELD,
  OPENED_UPDATED_AT_FIELD,
  type CareerField,
  type CareerFieldError,
  type CareerFormResult,
  type CareerFormValues,
} from '@/features/career/domain/career';
import { InputField, TextareaField } from '@/shared/components/field';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { MaskingField } from '@/shared/components/masking-field';
import { OrganizationNameFields } from '@/shared/components/organization-name-fields';
import { PERIOD_FIELD_MESSAGES } from '@/shared/components/period-field-messages';
import { SiteStatusField } from '@/shared/components/site-status-field';
import { DraftConflict, useDraft } from '@/shared/components/drafts';
import { FormActions } from '@/shared/components/form-actions';
import { FormGroup, SettingsGroup } from '@/shared/components/form-group';
import { SubmitButton } from '@/shared/components/submit-button';
import { formStateOf } from '@/shared/domain/action-result';

/**
 * 職歴を登録する・編集するフォーム（specs/001-career-and-project/contracts/dash.md）。
 * Server Action は props で受け取り、`server/` を読み込まない（ADR-0026 の依存の向き 3）。
 * 失敗の結果は送られた値を持ち、入力を消さずに理由を示す。組織名は、登録した組織の名前を選択肢に
 * 出す、ネイティブの `<datalist>` の入力（plan.md の U3）
 */

type Props = {
  action: (state: CareerFormResult | null, formData: FormData) => Promise<CareerFormResult>;
  initialValues: CareerFormValues;
  /** 組織名の選択肢。登録した組織の名前（FR-002） */
  organizationNames: string[];
  /** 編集する職歴。持てば編集のフォームで、楽観ロックの値を送る */
  career?: { uid: string; updatedAt: string };
};

const ERROR_MESSAGES: Record<CareerField, Partial<Record<CareerFieldError, string>>> = {
  organizationName: { missing: '組織名を入力してください' },
  organizationNameMasked: {
    'masked-name-required':
      '秘匿化するには、組織の秘匿化した組織名が要ります。秘匿化した組織名を入力してください',
  },
  role: { missing: '肩書を入力してください' },
  isMasked: {},
  status: {},
  ...PERIOD_FIELD_MESSAGES,
  description: {},
  url: { invalid: '関連 URL は http か https で始まる URL にしてください' },
};

const RESULT_MESSAGES = {
  forbidden: FORBIDDEN_INPUT_MESSAGE,
  invalid: INVALID_INPUT_MESSAGE,
  conflict:
    'この職歴は、開いた後に別の画面で保存されていました。保存していません。保存された内容を読み直します',
} as const;

/** 項目の名前。直しかけと、別の画面で保存された値の違いを知らせるのに使う */
const LABELS = {
  organizationName: '組織名',
  organizationNameMasked: '秘匿化した組織名',
  role: '肩書',
  isMasked: '秘匿化する',
  status: 'サイトに載せる',
  startedOn: '始まりの日',
  endedOn: '終わりの日',
  description: '本文',
  url: '関連 URL',
};

export const CareerForm = ({ action, initialValues, organizationNames, career }: Props) => {
  const [result, formAction] = useActionState(action, null);
  // 保存せずに別の 1 件を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(`career:${career?.uid ?? 'new'}`, initialValues, result, LABELS);
  const { values, errors } = formStateOf(result, draft.values);
  const errorOf = (field: CareerField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  return (
    <form key={draft.formKey} action={formAction} className="flex flex-col gap-8" {...draft.bind}>
      <DraftConflict conflict={draft.conflict} noun="職歴" />
      {career && (
        <>
          <input type="hidden" name={CAREER_UID_FIELD} value={career.uid} />
          <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={career.updatedAt} />
        </>
      )}
      {result && result.status !== 'saved' && (
        <FormAlert>{RESULT_MESSAGES[result.status]}</FormAlert>
      )}
      <SettingsGroup>
        <SiteStatusField status={values.status} />
        <MaskingField
          isMasked={values.isMasked}
          description="訪問者には秘匿化した組織名で出し、本文と画像を出しません"
        />
      </SettingsGroup>
      <FormGroup title="どこで">
        <OrganizationNameFields
          organizationNames={organizationNames}
          organizationName={values.organizationName}
          organizationNameMasked={values.organizationNameMasked}
          errorOf={errorOf}
        />
        <InputField
          name="role"
          label="肩書"
          defaultValue={values.role}
          autoComplete="off"
          error={errorOf('role')}
        />
      </FormGroup>
      <FormGroup title="いつ">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            type="date"
            name="startedOn"
            label="始まりの日"
            defaultValue={values.startedOn}
            error={errorOf('startedOn')}
          />
          <InputField
            type="date"
            name="endedOn"
            label="終わりの日"
            defaultValue={values.endedOn}
            error={errorOf('endedOn')}
          />
        </div>
        <p className="-mt-2 text-caption text-muted-foreground">
          終わりの日は、所属が続いているなら空にします
        </p>
      </FormGroup>
      <FormGroup title="中身">
        <TextareaField
          name="description"
          label="本文"
          rows={8}
          defaultValue={values.description}
          error={errorOf('description')}
        />
        <InputField
          inputMode="url"
          name="url"
          label="関連 URL"
          defaultValue={values.url}
          autoComplete="off"
          error={errorOf('url')}
        />
      </FormGroup>
      <FormActions>
        <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {career ? '保存する' : '登録する'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
