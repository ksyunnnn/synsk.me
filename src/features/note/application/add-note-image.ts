import type { NoteId } from '@/features/note/domain/note';
import {
  checkImage,
  checkImageSize,
  contentTypeOf,
  newImageFile,
  toStorageKey,
  type ImageError,
  type UploadedImage,
} from '@/shared/domain/media-image';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * note に画像を足す（FR-023、research.md の R7）。大きさ・形式・枚数の上限を超えたら足さない。
 * R2 に書いてから `media` に行を入れ、行を入れられなければ書いた物を消す。オーナーでなければ
 * 何も書かない（FR-033）
 */
export const addNoteImage = async (
  { notes, images }: Pick<NoteDeps, 'notes' | 'images'>,
  author: Author | null,
  id: NoteId,
  upload: UploadedImage | null,
): Promise<
  | { status: 'added'; file: string }
  | NoteOperationOutcome<ImageError | 'deleted' | 'too-many-images'>
> => {
  if (!author) return { status: 'forbidden' };
  if (!upload) return { status: 'missing' };
  // 大きさは中身を読む前に確かめる
  const sizeError = checkImageSize(upload.size);
  if (sizeError) return { status: sizeError };
  const bytes = await upload.read();
  const checked = checkImage(new Uint8Array(bytes));
  if (!checked.ok) return { status: checked.error };

  const file = newImageFile(checked.extension);
  const key = toStorageKey('notes', file);
  await images.put(key, bytes, contentTypeOf(file));
  const result = await notes.addImage(id, key);
  if (result.ok) return { status: 'added', file };
  await images.delete([key]);
  return { status: result.reason };
};
