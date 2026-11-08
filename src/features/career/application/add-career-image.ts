import type { CareerDeps } from '@/features/career/application/deps';
import type { CareerId } from '@/features/career/domain/career';
import type { Author } from '@/shared/domain/author';
import {
  checkImage,
  checkImageSize,
  contentTypeOf,
  newImageFile,
  toStorageKey,
  type ImageError,
  type UploadedImage,
} from '@/shared/domain/media-image';

export type AddCareerImageOutcome =
  | { status: 'added'; file: string }
  | { status: 'forbidden' | 'not-found' | 'too-many-images' | ImageError };

/**
 * 職歴に画像を足す（FR-027、research.md の R14）。大きさ・形式・枚数の上限を超えたら足さない
 * （constitution II）。置き場に書いてから `media` に行を入れ、行を入れられなければ書いた物を消す。
 * オーナーでなければ何も書かない（FR-040）
 */
export const addCareerImage = async (
  { careers, images }: Pick<CareerDeps, 'careers' | 'images'>,
  author: Author | null,
  id: CareerId,
  upload: UploadedImage | null,
): Promise<AddCareerImageOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (!upload) return { status: 'missing' };
  // 大きさは中身を読む前に確かめる
  const sizeError = checkImageSize(upload.size);
  if (sizeError) return { status: sizeError };
  const bytes = await upload.read();
  const checked = checkImage(new Uint8Array(bytes));
  if (!checked.ok) return { status: checked.error };

  const file = newImageFile(checked.extension);
  const key = toStorageKey('careers', file);
  await images.put(key, bytes, contentTypeOf(file));
  const result = await careers.addImage(id, key);
  if (result.ok) return { status: 'added', file };
  await images.delete([key]);
  return { status: result.reason };
};
