/**
 * 組織の型と決まり（specs/001-career-and-project/spec.md の FR-001〜FR-006・FR-041）。
 * 使い手は career・project・organization の機能と、002 の職務経歴書
 * （specs/001-career-and-project/research.md の R9・R10）。
 */

export type OrganizationId = number;

export type Organization = {
  id: OrganizationId;
  /** 組織名の実際の値 */
  name: string;
  /** 秘匿化した組織名。null なら持たない */
  nameMasked: string | null;
  /** 更新日時。ISO 8601 の文字列 */
  updatedAt: string;
};

/**
 * 個人の組織の id（FR-041、research.md の R9）。名前は変わりうるため、id で見分ける。
 *
 * 本番の D1 にオーナーが個人の組織を登録した後、その行の id を書く（tasks.md の T073）。
 * それまでは、AUTOINCREMENT が振らない 0 を置き、誰も指さない
 */
export const PERSONAL_ORGANIZATION_ID: OrganizationId = 0;

export const isPersonalOrganization = (id: OrganizationId): boolean =>
  id === PERSONAL_ORGANIZATION_ID;

/** 入力の組織名を、前後の空白を落として返す。空なら null */
export const parseOrganizationName = (value: string): string | null => {
  const name = value.trim();
  return name === '' ? null : name;
};

/**
 * 秘匿化した職歴・実績が、この組織を指せるか（FR-001）。秘匿化しない職歴・実績は
 * どの組織も指せる。秘匿化する職歴・実績は、秘匿化した組織名を持つ組織だけを指せる
 */
export const canBeReferencedAs = (
  organization: Pick<Organization, 'nameMasked'>,
  { isMasked }: { isMasked: boolean },
): boolean => !isMasked || hasMaskedName(organization);

/**
 * 組織の秘匿化した組織名を、この値に変えてよいか（FR-001）。秘匿化した職歴・実績が
 * 指している組織は、秘匿化した組織名を空にできない
 */
export const canChangeMaskedName = (
  nameMasked: string | null,
  { isReferencedByMasked }: { isReferencedByMasked: boolean },
): boolean => !isReferencedByMasked || hasMaskedName({ nameMasked });

const hasMaskedName = ({ nameMasked }: Pick<Organization, 'nameMasked'>) =>
  nameMasked !== null && nameMasked.trim() !== '';

/**
 * 組織の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/shared/server/organization-repository.ts にある
 */
export type OrganizationRepository = {
  /** 組織名の一覧。名前の順。組織名の入力の選択肢に使う（FR-002） */
  listNames: () => Promise<string[]>;
  /** 組織名で読む。無ければ null */
  findByName: (name: string) => Promise<Organization | null>;
  /**
   * 組織名で探し、無ければ作る（FR-002・FR-003）。既にある組織が秘匿化した組織名を
   * 持たなければ `nameMasked` を入れ、持っていれば変えない
   */
  findOrCreateByName: (name: string, nameMasked: string | null) => Promise<Organization>;
  /** id で読む。無ければ null */
  findById: (id: OrganizationId) => Promise<Organization | null>;
};
