'use client';

import { Popover } from '@base-ui/react/popover';
import { useActionState, useId } from 'react';
import {
  AS_CARD_IMAGE_FIELD,
  CARD_IMAGE_FIELD,
  NO_CARD_IMAGE,
  PROJECT_UID_FIELD,
  type CardImageFormResult,
} from '@/features/project/domain/project';
import { cn } from '@/lib/utils';
import { FORBIDDEN_MESSAGE, FormAlert } from '@/shared/components/form-alert';
import { MEDIA_ERROR_MESSAGES } from '@/shared/components/media-upload-form';
import { SubmitButton } from '@/shared/components/submit-button';
import {
  MEDIA_FILE_FIELD,
  MEDIA_MAX_BYTES,
  MEDIA_TYPES,
  type MediaFormResult,
} from '@/shared/domain/media';

/**
 * 実績の画像の区画。代表画像の枠と、その実績の画像の一覧と、画像を足すフォームを持つ
 * （FR-027・FR-028）。代表画像は 1 つの枠で、空なら「設定」、あれば画像と「差し替え」「削除」を出す
 * （WordPress のアイキャッチ画像の書き方、https://wordpress.org/documentation/article/page-post-settings-sidebar/ ）。
 * 本文に画像を入れるのは本文の入力（`MediaAttachTextareaField`）で、この区画は印を出さない。
 * Server Action は props で受け取る（ADR-0026 の依存の向き 3）
 */

type Props = {
  projectUid: string;
  /** この実績の画像の置き場のキー。足した順 */
  mediaStorageKeys: string[];
  cardMediaKey: string | null;
  /** 保存した本文が指す画像の置き場のキー */
  bodyMediaKeys: string[];
  /** 画像の URL。オーナーにだけ返す経路 */
  mediaUrls: Record<string, string>;
  changeCardImage: (
    state: CardImageFormResult | null,
    formData: FormData,
  ) => Promise<CardImageFormResult>;
  addMedia: (state: MediaFormResult | null, formData: FormData) => Promise<MediaFormResult>;
};

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const BUTTON = cn(
  'rounded-full px-4 py-1.5 text-small font-medium ring-1 ring-border hover:bg-foreground/5 disabled:opacity-50',
  FOCUS,
);
const MAX_MB = MEDIA_MAX_BYTES / 1024 / 1024;

export const ProjectMediaSection = (props: Props) => (
  <div className="flex flex-col gap-8">
    <CardImageSlot {...props} />
    <MediaGrid {...props} />
    <AddMediaForm {...props} />
  </div>
);

const CardImageSlot = ({
  projectUid,
  mediaStorageKeys,
  cardMediaKey,
  mediaUrls,
  changeCardImage,
}: Props) => {
  const [result, formAction] = useActionState(changeCardImage, null);
  const formId = useId();
  const message =
    result?.status === 'forbidden'
      ? FORBIDDEN_MESSAGE
      : result?.status === 'invalid'
        ? result.errors[CARD_IMAGE_FIELD] === 'media-not-owned'
          ? 'この実績の画像だけを代表画像に選べます'
          : '代表画像を選び直してください'
        : null;

  return (
    <form id={formId} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={PROJECT_UID_FIELD} value={projectUid} />
      <h4 className="text-small font-medium">代表画像</h4>
      {cardMediaKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- オーナーにだけ返す経路で、最適化の経路を通さない
        <img
          src={mediaUrls[cardMediaKey]}
          alt="代表画像"
          className="aspect-video w-full max-w-sm rounded-xl bg-muted object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-border text-small text-muted-foreground">
          代表画像はありません
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <CardImagePicker
          formId={formId}
          label={cardMediaKey ? '差し替え' : '設定'}
          mediaStorageKeys={mediaStorageKeys}
          cardMediaKey={cardMediaKey}
          mediaUrls={mediaUrls}
        />
        {cardMediaKey && (
          <SubmitButton name={CARD_IMAGE_FIELD} value={NO_CARD_IMAGE} className={BUTTON}>
            削除
          </SubmitButton>
        )}
      </div>
      {mediaStorageKeys.length === 0 && (
        <p className="text-caption text-muted-foreground">
          画像を足すと、その中から代表画像を設定できます
        </p>
      )}
      {message && <FormAlert>{message}</FormAlert>}
    </form>
  );
};

/** この実績の画像から代表画像を選ぶ Popover。選ぶと送る。中の画像は枠のフォームの送信のボタン */
const CardImagePicker = ({
  formId,
  label,
  mediaStorageKeys,
  cardMediaKey,
  mediaUrls,
}: {
  formId: string;
  label: string;
  mediaStorageKeys: string[];
  cardMediaKey: string | null;
  mediaUrls: Record<string, string>;
}) => (
  <Popover.Root>
    <Popover.Trigger className={BUTTON} disabled={mediaStorageKeys.length === 0}>
      {label}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={6} align="start" className="z-50">
        <Popover.Popup className="flex max-h-[60dvh] w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-2xl bg-background p-3 shadow-lg ring-1 ring-border outline-none">
          <Popover.Title className="text-small font-medium">代表画像にする画像を選ぶ</Popover.Title>
          <ul className="grid grid-cols-3 gap-2">
            {mediaStorageKeys.map((key, index) => (
              <li key={key}>
                <button
                  type="submit"
                  form={formId}
                  name={CARD_IMAGE_FIELD}
                  value={key}
                  aria-current={key === cardMediaKey ? 'true' : undefined}
                  className={cn(
                    'block w-full overflow-hidden rounded-lg ring-offset-2 aria-[current]:ring-2 aria-[current]:ring-tint',
                    FOCUS,
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- オーナーにだけ返す経路 */}
                  <img
                    src={mediaUrls[key]}
                    alt={`画像 ${index + 1}`}
                    className="aspect-square w-full bg-muted object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

const MediaGrid = ({ mediaStorageKeys, cardMediaKey, bodyMediaKeys, mediaUrls }: Props) => (
  <div className="flex flex-col gap-3">
    <h4 className="text-small font-medium">この実績の画像</h4>
    {mediaStorageKeys.length === 0 ? (
      <p className="text-small text-muted-foreground">
        画像はありません。本文の入力に画像を落とすか貼ると、ここに足されます
      </p>
    ) : (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mediaStorageKeys.map((key, index) => {
          const inBody = bodyMediaKeys.includes(key);
          return (
            <li key={key} className="flex flex-col gap-1.5">
              <a
                href={mediaUrls[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- オーナーにだけ返す経路 */}
                <img
                  src={mediaUrls[key]}
                  alt={`画像 ${index + 1}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl bg-muted object-cover"
                />
              </a>
              <div className="flex flex-wrap items-center gap-1 text-caption">
                {key === cardMediaKey && (
                  <span className="rounded-full bg-tint/12 px-2 py-0.5 font-medium text-tint">
                    代表画像
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    inBody ? 'bg-foreground/6' : 'text-muted-foreground ring-1 ring-border',
                  )}
                >
                  {inBody ? '本文で使用中' : '本文で未使用'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

/** 本文に入れずに画像を足すフォーム。代表画像にもできる（FR-028 の「本文とは別に登録」） */
const AddMediaForm = ({ projectUid, addMedia }: Props) => {
  const [result, formAction] = useActionState(addMedia, null);
  const reason = result?.status === 'invalid' ? result.errors[MEDIA_FILE_FIELD] : undefined;
  const message =
    result?.status === 'forbidden' ? FORBIDDEN_MESSAGE : reason && MEDIA_ERROR_MESSAGES[reason];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={PROJECT_UID_FIELD} value={projectUid} />
      <label className="flex flex-col gap-1">
        <span className="text-small font-medium">本文に入れずに画像を足す</span>
        <span className="text-caption text-muted-foreground">
          JPEG・PNG・WebP・GIF、1 枚 {MAX_MB} MB まで
        </span>
        <input
          type="file"
          name={MEDIA_FILE_FIELD}
          accept={MEDIA_TYPES.join(',')}
          className={cn('text-small', FOCUS)}
        />
      </label>
      <label className="flex items-center gap-2 text-small">
        <input
          type="checkbox"
          name={AS_CARD_IMAGE_FIELD}
          value="1"
          className={cn('size-4 accent-tint', FOCUS)}
        />
        代表画像にする
      </label>
      {message && <FormAlert>{message}</FormAlert>}
      <div>
        <SubmitButton className={BUTTON}>画像を足す</SubmitButton>
      </div>
    </form>
  );
};
