import type { ProjectId } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { Author } from '@/shared/domain/author';
import {
  saveAndRecordMedia,
  type MediaRejection,
  type MediaStorage,
  type MediaStorageKey,
} from '@/shared/domain/media';

/*
 * 実績の画像（specs/001-career-and-project/spec.md の FR-027・FR-028・FR-030）。形式と大きさと
 * 置き場の総量の検査と、置き場への書き込みは共有の `MediaStorage` が持つ。1 回の操作で 1 枚
 * （specs/003-note/research.md の R12 に合わせる）
 */

export type AddProjectMediaOutcome =
  | { status: 'added'; storageKey: MediaStorageKey }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: MediaRejection };

/**
 * 実績に画像を 1 枚足す。`asCardImage` なら代表画像にもする（FR-028 の「本文とは別に登録」）。
 * オーナーでなければ何も書かない（FR-040）。
 *
 * 置き場に置く → 記録する、の順。記録の前に実績が削除されていたら、置いた画像を消して not-found を
 * 返す。記録が例外で失敗したときも、置いた画像を消してから投げ直す
 */
export const addProjectMedia = async (
  { projects, media }: { projects: ProjectRepository; media: MediaStorage },
  author: Author | null,
  id: ProjectId,
  file: Blob | null,
  options: { asCardImage: boolean },
): Promise<AddProjectMediaOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (file === null) return { status: 'invalid', error: 'empty' };

  return saveAndRecordMedia(
    media,
    file,
    async (saved) => (await projects.addMedia(id, saved, options)).ok,
  );
};

export type ChangeProjectCardImageOutcome =
  | { status: 'changed' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: 'invalid' | 'media-not-owned' };

/**
 * 代表画像を選ぶ・外す（FR-028）。`value` はその実績の画像の置き場のキーか、外す `none`。
 * 選べるのはその実績の画像だけ
 */
export const changeProjectCardImage = async (
  projects: ProjectRepository,
  author: Author | null,
  id: ProjectId,
  storageKey: MediaStorageKey | null,
): Promise<ChangeProjectCardImageOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await projects.changeCardImage(id, storageKey);
  if (result.ok) return { status: 'changed' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', error: 'media-not-owned' };
};
