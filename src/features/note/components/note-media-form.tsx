'use client';

import { NOTE_UID_FIELD } from '@/features/note/domain/note';
import { MediaUploadForm } from '@/shared/components/media-upload-form';
import type { MediaFormResult } from '@/shared/domain/media';

/**
 * note の画像を足すフォームと、足した画像を本文に貼る印の一覧（FR-023、specs/003-note/contracts/dash.md）。
 * 1 回の操作で 1 枚。形式と大きさは共有担当の media-storage.ts が確かめる（research.md の R12）。
 * 印は `media.storage_key` で画像を指し、主キーを出さない（research.md の R11）
 */

type Action = (state: MediaFormResult | null, formData: FormData) => Promise<MediaFormResult>;

type Props = { action: Action; noteUid: string; mediaStorageKeys: string[] };

export const NoteMediaForm = ({ action, noteUid, mediaStorageKeys }: Props) => (
  <MediaUploadForm
    action={action}
    owner={{ field: NOTE_UID_FIELD, uid: noteUid }}
    mediaStorageKeys={mediaStorageKeys}
  />
);
