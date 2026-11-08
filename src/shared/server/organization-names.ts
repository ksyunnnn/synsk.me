import 'server-only';

import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';

/**
 * 組織名の入力の選択肢（specs/001-career-and-project/spec.md の FR-002）。登録した組織名を名前の
 * 順に返す。実績と職歴の入力の画面が呼ぶ組み立て用の関数（docs/SOFTWARE_DESIGN.md）。
 * オーナーでなければ、読む前に 403 になる
 */
export const listOrganizationNames = async (): Promise<string[]> => {
  await requireAuthor();
  return createD1OrganizationRepository((await readEnv()).DB).listNames();
};
