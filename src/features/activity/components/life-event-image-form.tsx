'use client';

import { useActionState } from 'react';
import {
  LIFE_EVENT_IMAGE_FIELD,
  LIFE_EVENT_UID_FIELD,
  type LifeEventImageResult as Result,
} from '@/features/activity/domain/life-event';
import {
  MEDIA_STORAGE_FULL_MESSAGE,
  MEDIA_TYPES,
  type MediaRejection,
} from '@/shared/domain/media';
import { FORBIDDEN_MESSAGE, FormAlert } from '@/shared/components/form-alert';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * life event の代表画像を登録する・外すフォーム（specs/004-external-activity/contracts/dash.md）。
 * Server Action は props で受け取る（ADR-0026 の依存の向き 3）。1 つの life event の画像は 1 枚まで
 * で、新しく登録すると前の画像を消す（research.md の R12）
 */

type Action = (state: Result | null, formData: FormData) => Promise<Result>;

type Props = {
  uid: string;
  cardImageUrl: string | null;
  register: Action;
  remove: Action;
};

const MESSAGES: Record<'forbidden' | MediaRejection, string> = {
  forbidden: FORBIDDEN_MESSAGE,
  empty: '画像のファイルを選んでください',
  'too-large': '画像は 1 枚 10 MB までです',
  'unsupported-type': '画像は JPEG・PNG・WebP・GIF のどれかにしてください',
  'storage-full': MEDIA_STORAGE_FULL_MESSAGE,
};

const messageOf = (result: Result | null) =>
  result === null ? null : MESSAGES[result.status === 'rejected' ? result.reason : result.status];

const buttonClass =
  'rounded-md px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const LifeEventImageForm = ({ uid, cardImageUrl, register, remove }: Props) => {
  const [registerResult, registerAction] = useActionState(register, null);
  const [removeResult, removeAction] = useActionState(remove, null);
  const message = messageOf(registerResult) ?? messageOf(removeResult);

  return (
    <section aria-labelledby="life-event-image-heading" className="flex flex-col gap-4">
      <h2 id="life-event-image-heading" className="text-xl font-bold">
        代表画像
      </h2>
      {message && <FormAlert>{message}</FormAlert>}
      {cardImageUrl ? (
        // 代表画像の説明の文は持たない（spec が決めていない）。見出しが何の画像かを示す
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cardImageUrl} alt="今の代表画像" className="max-h-64 w-fit rounded-md" />
      ) : (
        <p>代表画像はありません</p>
      )}
      <form action={registerAction} className="flex flex-col gap-2">
        <input type="hidden" name={LIFE_EVENT_UID_FIELD} value={uid} />
        <label htmlFor="life-event-image" className="font-medium">
          画像のファイル
        </label>
        <input
          id="life-event-image"
          type="file"
          name={LIFE_EVENT_IMAGE_FIELD}
          accept={MEDIA_TYPES.join(',')}
          aria-describedby="life-event-image-hint"
        />
        <p id="life-event-image-hint" className="text-sm text-muted-foreground">
          JPEG・PNG・WebP・GIF の 1 枚 10 MB まで。登録すると前の画像を消します
        </p>
        <div>
          <SubmitButton className={`${buttonClass} bg-primary text-primary-foreground`}>
            画像を登録する
          </SubmitButton>
        </div>
      </form>
      {cardImageUrl && (
        <form action={removeAction}>
          <input type="hidden" name={LIFE_EVENT_UID_FIELD} value={uid} />
          <SubmitButton className={`${buttonClass} border border-input`}>
            代表画像を外す
          </SubmitButton>
        </form>
      )}
    </section>
  );
};
