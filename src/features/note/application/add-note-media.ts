import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { MediaRejection, MediaStorageKey } from '@/shared/domain/media';
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
  { notes, media }: NoteDeps,
  author: Author | null,
  id: NoteId,
  file: Blob | null,
): Promise<AddNoteMediaOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await notes.findForEdit(id);
  if (!current || current.deletedAt !== null) return { status: 'not-found' };
  if (file === null) return { status: 'invalid', error: 'empty' };

  const saved = await media.save(file);
  if (!saved.ok) return { status: 'invalid', error: saved.reason };

  const { storageKey, size } = saved.media;
  let recorded: boolean;
  try {
    recorded = (await notes.addMedia(id, storageKey, size)).ok;
  } catch (error) {
    await media.remove([storageKey]);
    throw error;
  }
  if (recorded) return { status: 'added', storageKey };
  await media.remove([storageKey]);
  return { status: 'not-found' };
};
