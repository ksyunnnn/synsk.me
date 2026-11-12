'use client';

import {
  CARD_IMAGE_FIELD,
  NO_CARD_IMAGE,
  PROJECT_UID_FIELD,
  type CardImageFormResult,
} from '@/features/project/domain/project';
import { CardImageForm } from '@/shared/components/card-image-form';

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

export const ProjectCardImageForm = ({ action, projectUid, current, mediaStorageKeys }: Props) => (
  <CardImageForm
    action={action}
    field={CARD_IMAGE_FIELD}
    owner={{ field: PROJECT_UID_FIELD, uid: projectUid }}
    options={[
      { value: NO_CARD_IMAGE, label: '代表画像なし' },
      ...mediaStorageKeys.map((key) => ({ value: key, label: `画像 ${key}` })),
    ]}
    currentValue={current ?? NO_CARD_IMAGE}
    mediaNotOwnedMessage="この実績の画像だけを代表画像に選べます"
    submitLabel="代表画像を選び直す"
  />
);
