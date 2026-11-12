import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import {
  saveAndRecordMedia,
  type MediaRejection,
  type MediaStorageKey,
} from '@/shared/domain/media';
import type { NoteDeps } from './deps';

export type AddNoteMediaOutcome =
  | { status: 'added'; storageKey: MediaStorageKey }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: MediaRejection };

/**
 * note に画像を 1 枚足す（FR-023、research.md の R12）。形式と大きさの検査と置き場への書き込みは
 * 共有担当の `MediaStorage` が持つ。オーナーでなければ何も書かない（FR-033）。
 *
 * 読む（note があるか）→ 置き場に置く → 記録する、の順。記録の前に note が削除されていたら、
 * 置いた画像を消して not-found を返す。記録が例外で失敗したときも、置いた画像を消してから投げ直す
 */
export const addNoteMedia = async (
  { notes, media }: Pick<NoteDeps, 'notes' | 'media'>,
  author: Author | null,
  id: NoteId,
  file: Blob | null,
): Promise<AddNoteMediaOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await notes.findForEdit(id);
  if (!current || current.deletedAt !== null) return { status: 'not-found' };
  if (file === null) return { status: 'invalid', error: 'empty' };

  return saveAndRecordMedia(
    media,
    file,
    async ({ storageKey, size }) => (await notes.addMedia(id, storageKey, size)).ok,
  );
};
