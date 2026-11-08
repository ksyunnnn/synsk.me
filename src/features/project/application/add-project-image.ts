import type { ProjectDeps } from '@/features/project/application/deps';
import type { ProjectId } from '@/features/project/domain/project';
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

export type AddProjectImageOutcome =
  | { status: 'added'; file: string }
  | { status: 'forbidden' | 'not-found' | 'too-many-images' | ImageError };

/**
 * 実績に画像を足す（FR-027・FR-028、research.md の R14）。大きさ・形式・枚数の上限を超えたら
 * 足さない（constitution II）。置き場に書いてから `media` に行を入れ、行を入れられなければ書いた物を
 * 消す。オーナーでなければ何も書かない（FR-040）
 */
export const addProjectImage = async (
  { projects, images }: Pick<ProjectDeps, 'projects' | 'images'>,
  author: Author | null,
  id: ProjectId,
  upload: UploadedImage | null,
): Promise<AddProjectImageOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (!upload) return { status: 'missing' };
  // 大きさは中身を読む前に確かめる
  const sizeError = checkImageSize(upload.size);
  if (sizeError) return { status: sizeError };
  const bytes = await upload.read();
  const checked = checkImage(new Uint8Array(bytes));
  if (!checked.ok) return { status: checked.error };

  const file = newImageFile(checked.extension);
  const key = toStorageKey('projects', file);
  await images.put(key, bytes, contentTypeOf(file));
  const result = await projects.addImage(id, key);
  if (result.ok) return { status: 'added', file };
  await images.delete([key]);
  return { status: result.reason };
};
