'use client';

import {
  CARD_IMAGE_FIELD,
  NOTE_UID_FIELD,
  toCardImageValue,
  type CardImageFormResult,
  type VisitorNoteCardImage,
} from '@/features/note/domain/note';
import { CardImageForm } from '@/shared/components/card-image-form';

/**
 * 代表画像の出どころを選ぶフォーム（FR-024・FR-025、specs/003-note/contracts/dash.md）。
 * note 用のサイト共通の画像・その note の画像から 1 つを選ぶ。選べる画像はその note の画像だけ
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

export const NoteCardImageForm = ({ action, noteUid, current, mediaStorageKeys }: Props) => (
  <CardImageForm
    action={action}
    field={CARD_IMAGE_FIELD}
    owner={{ field: NOTE_UID_FIELD, uid: noteUid }}
    options={[
      { value: 'site', label: 'note 用のサイト共通の画像' },
      ...mediaStorageKeys.map((storageKey) => ({
        value: toCardImageValue({ kind: 'media', storageKey }),
        label: `画像 ${storageKey}`,
      })),
    ]}
    currentValue={toCardImageValue(current)}
    mediaNotOwnedMessage="この note の画像だけを代表画像に選べます"
    submitLabel="代表画像を変える"
  />
);
