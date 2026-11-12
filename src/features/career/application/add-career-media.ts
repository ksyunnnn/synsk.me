import type { CareerId } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { Author } from '@/shared/domain/author';
import {
  saveAndRecordMedia,
  type MediaRejection,
  type MediaStorage,
  type MediaStorageKey,
} from '@/shared/domain/media';

export type AddCareerMediaOutcome =
  | { status: 'added'; storageKey: MediaStorageKey }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: MediaRejection };

/**
 * 職歴の本文の画像を 1 枚足す（specs/001-career-and-project/spec.md の FR-027）。1 回の操作で 1 枚
 * （specs/003-note/research.md の R12）。形式と大きさと置き場の総量の検査は共有の `MediaStorage` が
 * 持つ。オーナーでなければ何も書かない（FR-040）。
 *
 * 置き場に置く → 記録する、の順。記録の前に職歴が削除されていたら、置いた画像を消して not-found を
 * 返す。記録が例外で失敗したときも、置いた画像を消してから投げ直す
 */
export const addCareerMedia = async (
  { careers, media }: { careers: CareerRepository; media: MediaStorage },
  author: Author | null,
  id: CareerId,
  file: Blob | null,
): Promise<AddCareerMediaOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (file === null) return { status: 'invalid', error: 'empty' };

  return saveAndRecordMedia(media, file, async (saved) => (await careers.addMedia(id, saved)).ok);
};
