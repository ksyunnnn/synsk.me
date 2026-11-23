'use client';

import { useActionState } from 'react';
import {
  SKILL_UID_FIELD,
  type SkillField,
  type SkillFieldError,
  type SkillFormResult,
  type SkillFormValues,
} from '@/features/skill/domain/skill';
import { InputField } from '@/shared/components/field';
import { useDetailForm } from '@/shared/components/detail-sheet';
import { FormActions } from '@/shared/components/form-actions';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';
import { DraftConflict, useDraft } from '@/shared/components/drafts';
import { formStateOf } from '@/shared/domain/action-result';

/**
 * スキルを登録する・編集するフォーム。上書きの経験年数は年と月で入れる（FR-034）。
 * Server Action は props で受け取り、`server/` を読み込まない（ADR-0026 の依存の向き 3）
 */

type Props = {
  action: (state: SkillFormResult | null, formData: FormData) => Promise<SkillFormResult>;
  initialValues: SkillFormValues;
  /** 編集するスキルの uid。持てば編集のフォーム */
  skillUid?: string;
};

const ERROR_MESSAGES: Record<SkillField, Partial<Record<SkillFieldError, string>>> = {
  name: {
    missing: '名前を入力してください',
    'name-taken': '大文字と小文字だけが違う名前のスキルが、ほかにあります',
  },
  overrideYears: { invalid: '年は 0 以上の整数で入力してください' },
  overrideMonths: { invalid: '月は 0 から 11 の整数で入力してください' },
};

/** 項目の名前。直しかけと、別の画面で保存された値の違いを知らせるのに使う */
const LABELS = {
  name: '名前',
  overrideYears: '経験年数の上書きの年',
  overrideMonths: '経験年数の上書きのか月',
};

export const SkillForm = ({ action, initialValues, skillUid }: Props) => {
  const [result, formAction, isPending] = useActionState(action, null);
  // 詳細のペインに置かれたら、保存のボタンをペインの上の行に任せる
  const detailForm = useDetailForm(isPending);
  // 保存せずに別の 1 件を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(`skill:${skillUid ?? 'new'}`, initialValues, result, LABELS);
  const { values, errors } = formStateOf(result, draft.values);
  const errorOf = (field: SkillField) => {
    const reason = errors[field];
    return reason ? ERROR_MESSAGES[field][reason] : undefined;
  };

  return (
    <form
      key={draft.formKey}
      action={formAction}
      {...detailForm}
      className="flex flex-col gap-6"
      {...draft.bind}
    >
      <DraftConflict conflict={draft.conflict} noun="スキル" />
      {skillUid !== undefined && <input type="hidden" name={SKILL_UID_FIELD} value={skillUid} />}
      {result?.status === 'forbidden' && <FormAlert>{FORBIDDEN_INPUT_MESSAGE}</FormAlert>}
      {result?.status === 'invalid' && <FormAlert>{INVALID_INPUT_MESSAGE}</FormAlert>}
      <InputField
        name="name"
        label="名前"
        defaultValue={values.name}
        autoComplete="off"
        error={errorOf('name')}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-bold">経験年数の上書き</legend>
        <p className="text-sm text-muted-foreground">
          空にすると、このスキルをつないだ実績の期間から求めます
        </p>
        <div className="grid grid-cols-2 gap-4">
          <InputField
            name="overrideYears"
            label="年"
            inputMode="numeric"
            defaultValue={values.overrideYears}
            autoComplete="off"
            error={errorOf('overrideYears')}
          />
          <InputField
            name="overrideMonths"
            label="か月"
            inputMode="numeric"
            defaultValue={values.overrideMonths}
            autoComplete="off"
            error={errorOf('overrideMonths')}
          />
        </div>
      </fieldset>
      {!detailForm && (
        <FormActions>
          <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {skillUid === undefined ? '登録する' : '保存する'}
          </SubmitButton>
        </FormActions>
      )}
    </form>
  );
};
