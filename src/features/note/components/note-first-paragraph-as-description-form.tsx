'use client';

import { useActionState } from 'react';
import {
  FIRST_PARAGRAPH_AS_DESCRIPTION_FIELD,
  NOTE_UID_FIELD,
  type FirstParagraphAsDescriptionFormResult,
} from '@/features/note/domain/note';
import { FORBIDDEN_MESSAGE, FormAlert } from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * 説明文が空のときに、本文の最初の段落を説明に使うかを選ぶフォーム（FR-034、
 * specs/003-note/contracts/dash.md）。版でなく note の設定なので、保存のフォームと分け、
 * 代表画像のフォームと同じく選んだらすぐ書く
 */

type Action = (
  state: FirstParagraphAsDescriptionFormResult | null,
  formData: FormData,
) => Promise<FirstParagraphAsDescriptionFormResult>;

type Props = {
  action: Action;
  noteUid: string;
  current: boolean;
};

const MESSAGES = {
  forbidden: FORBIDDEN_MESSAGE,
  invalid: 'どちらかを選び直してください',
} as const;

const RADIO =
  'size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const NoteFirstParagraphAsDescriptionForm = ({ action, noteUid, current }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const message =
    result?.status === 'forbidden'
      ? MESSAGES.forbidden
      : result?.status === 'invalid'
        ? MESSAGES.invalid
        : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg font-bold">説明文が空のとき</legend>
        <p className="text-sm text-muted-foreground">
          検索結果や、リンクを貼ったときのカードに出す説明です。説明文を書いた版は、どちらを選んでも説明文を出します
        </p>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={FIRST_PARAGRAPH_AS_DESCRIPTION_FIELD}
            value="1"
            defaultChecked={current}
            className={RADIO}
          />
          本文の最初の段落を説明に使う
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={FIRST_PARAGRAPH_AS_DESCRIPTION_FIELD}
            value="0"
            defaultChecked={!current}
            className={RADIO}
          />
          説明を出さない
        </label>
      </fieldset>
      {message && <FormAlert>{message}</FormAlert>}
      <div>
        <SubmitButton className="rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          説明文が空のときの説明を変える
        </SubmitButton>
      </div>
    </form>
  );
};
