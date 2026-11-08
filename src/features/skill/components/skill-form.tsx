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

export const SkillForm = ({ action, initialValues, skillUid }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: SkillField) => {
    const reason = errors[field];
    return reason ? ERROR_MESSAGES[field][reason] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {skillUid !== undefined && <input type="hidden" name={SKILL_UID_FIELD} value={skillUid} />}
      {result?.status === 'forbidden' && (
        <p role="alert" className="text-destructive">
          オーナーであることを確かめられませんでした。ログインし直してから入力し直してください
        </p>
      )}
      {result?.status === 'invalid' && (
        <p role="alert" className="text-destructive">
          入力を確かめてください
        </p>
      )}
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
      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {skillUid === undefined ? '登録する' : '保存する'}
        </button>
      </div>
    </form>
  );
};
