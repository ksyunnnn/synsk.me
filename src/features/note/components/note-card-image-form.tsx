'use client';

import { useActionState } from 'react';
import {
  CARD_IMAGE_FIELD,
  NOTE_UID_FIELD,
  toCardImageValue,
  type CardImageFormResult,
  type VisitorNoteCardImage,
} from '@/features/note/domain/note';

/**
 * 代表画像の出どころを選ぶフォーム（FR-024・FR-025、specs/003-note/contracts/dash.md）。
 * サイト共通の画像・その note の画像から 1 つを選ぶ。選べる画像はその note の画像だけ
 */

type Action = (
  state: CardImageFormResult | null,
  formData: FormData,
) => Promise<CardImageFormResult>;

type Props = {
  action: Action;
  noteUid: string;
  current: VisitorNoteCardImage;
  mediaStorageKeys: string[];
};

const MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  invalid: '代表画像を選び直してください',
  'media-not-owned': 'この note の画像だけを代表画像に選べます',
} as const;

const RADIO =
  'size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const NoteCardImageForm = ({ action, noteUid, current, mediaStorageKeys }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const message =
    result?.status === 'forbidden'
      ? MESSAGES.forbidden
      : result?.status === 'invalid'
        ? MESSAGES[result.errors[CARD_IMAGE_FIELD] ?? 'invalid']
        : null;
  const currentValue = toCardImageValue(current);

  const options: { value: string; label: string }[] = [
    { value: 'site', label: 'サイト共通の画像' },
    ...mediaStorageKeys.map((storageKey) => ({
      value: toCardImageValue({ kind: 'media', storageKey }),
      label: `画像 ${storageKey}`,
    })),
  ];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg font-bold">代表画像</legend>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 break-all">
            <input
              type="radio"
              name={CARD_IMAGE_FIELD}
              value={option.value}
              defaultChecked={option.value === currentValue}
              className={RADIO}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <div>
        <button
          type="submit"
          className="rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          代表画像を変える
        </button>
      </div>
    </form>
  );
};
