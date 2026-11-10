'use client';

import { useActionState } from 'react';
import {
  CARD_IMAGE_FIELD,
  NO_CARD_IMAGE,
  PROJECT_UID_FIELD,
  type CardImageFormResult,
} from '@/features/project/domain/project';

/**
 * 実績の代表画像を選ぶフォーム（FR-028、specs/001-career-and-project/contracts/dash.md）。
 * 選べるのはその実績の画像だけ。新しい画像を代表画像にするときは、画像を足すフォームで
 * 「代表画像にする」を選ぶ
 */

type Action = (
  state: CardImageFormResult | null,
  formData: FormData,
) => Promise<CardImageFormResult>;

type Props = {
  action: Action;
  projectUid: string;
  current: string | null;
  mediaStorageKeys: string[];
};

const MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  invalid: '代表画像を選び直してください',
  'media-not-owned': 'この実績の画像だけを代表画像に選べます',
} as const;

const RADIO =
  'size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const ProjectCardImageForm = ({ action, projectUid, current, mediaStorageKeys }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const message =
    result?.status === 'forbidden'
      ? MESSAGES.forbidden
      : result?.status === 'invalid'
        ? MESSAGES[result.errors[CARD_IMAGE_FIELD] ?? 'invalid']
        : null;

  const options = [
    { value: NO_CARD_IMAGE, label: '代表画像なし' },
    ...mediaStorageKeys.map((key) => ({ value: key, label: `画像 ${key}` })),
  ];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={PROJECT_UID_FIELD} value={projectUid} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg font-bold">代表画像</legend>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 break-all">
            <input
              type="radio"
              name={CARD_IMAGE_FIELD}
              value={option.value}
              defaultChecked={option.value === (current ?? NO_CARD_IMAGE)}
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
          代表画像を選び直す
        </button>
      </div>
    </form>
  );
};
