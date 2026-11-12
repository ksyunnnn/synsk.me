'use client';

import { useActionState } from 'react';
import { FORBIDDEN_MESSAGE, FormAlert } from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';
import type { ActionResult } from '@/shared/domain/action-result';

/**
 * 代表画像を選ぶラジオボタンのフォーム。選択肢と持ち主の uid の欄は使い手が渡す。
 * 使い手は note（FR-024・FR-025）と実績（FR-028）。Server Action は props で受け取る
 * （ADR-0026 の依存の向き 3）
 */

type Result<Field extends string> = ActionResult<Field, 'invalid' | 'media-not-owned'>;

const RADIO =
  'size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const CardImageForm = <Field extends string>({
  action,
  field,
  owner,
  options,
  currentValue,
  mediaNotOwnedMessage,
  submitLabel,
}: {
  action: (state: Result<Field> | null, formData: FormData) => Promise<Result<Field>>;
  /** 選んだ値を送る入力の名前 */
  field: Field;
  /** 持ち主を指す、フォームが送る値（例: `noteUid` とその uid） */
  owner: { field: string; uid: string };
  options: { value: string; label: string }[];
  /** 初めに選ぶ値 */
  currentValue: string;
  /** 持ち主の画像でない値を送ったときの文言 */
  mediaNotOwnedMessage: string;
  submitLabel: string;
}) => {
  const [result, formAction] = useActionState(action, null);
  const messages = {
    invalid: '代表画像を選び直してください',
    'media-not-owned': mediaNotOwnedMessage,
  };
  const message =
    result?.status === 'forbidden'
      ? FORBIDDEN_MESSAGE
      : result?.status === 'invalid'
        ? messages[result.errors[field] ?? 'invalid']
        : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={owner.field} value={owner.uid} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg font-bold">代表画像</legend>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 break-all">
            <input
              type="radio"
              name={field}
              value={option.value}
              defaultChecked={option.value === currentValue}
              className={RADIO}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {message && <FormAlert>{message}</FormAlert>}
      <div>
        <SubmitButton className="rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
};
