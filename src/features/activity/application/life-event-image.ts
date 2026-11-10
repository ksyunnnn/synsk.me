import type { LifeEventId } from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaRejection, MediaStorage, MediaStorageKey } from '@/shared/domain/media';

/**
 * life event の代表画像を登録する・外す（specs/004-external-activity/spec.md の FR-028・FR-029、
 * research.md の R12）。オーナーでなければ何もしない（FR-031）。形式と大きさは共有担当の置き場が
 * 確かめる。1 つの life event の画像は 1 枚までで、新しく登録すると前の画像を消す
 */

export type LifeEventImageOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'rejected'; reason: MediaRejection };

/**
 * 置き場から消す。D1 から辿れる行はもう無いので、失敗しても結果を変えない。置き場に残ったものの
 * 扱いは共有担当の部品に合わせる（R12）
 */
export const removeFromStorage = async (storage: MediaStorage, keys: MediaStorageKey[]) => {
  if (keys.length === 0) return;
  try {
    await storage.remove(keys);
  } catch {
    // 上の注記のとおり
  }
};

export const registerLifeEventImage = async (
  lifeEvents: LifeEventRepository,
  storage: MediaStorage,
  author: Author | null,
  id: LifeEventId,
  file: Blob,
): Promise<LifeEventImageOutcome> => {
  if (!author) return { status: 'forbidden' };

  const saved = await storage.save(file);
  if (!saved.ok) return { status: 'rejected', reason: saved.reason };
  const { storageKey, size } = saved.media;

  let result;
  try {
    result = await lifeEvents.replaceCardImage(id, storageKey, size);
  } catch (error) {
    await removeFromStorage(storage, [storageKey]);
    throw error;
  }
  if (!result.ok) {
    await removeFromStorage(storage, [storageKey]);
    return { status: 'not-found' };
  }
  await removeFromStorage(storage, result.removedKeys);
  return { status: 'saved' };
};

export const removeLifeEventImage = async (
  lifeEvents: LifeEventRepository,
  storage: MediaStorage,
  author: Author | null,
  id: LifeEventId,
): Promise<LifeEventImageOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await lifeEvents.removeCardImage(id);
  if (!result.ok) return { status: 'not-found' };
  await removeFromStorage(storage, result.removedKeys);
  return { status: 'saved' };
};
