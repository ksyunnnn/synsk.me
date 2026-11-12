/**
 * 組織の型と決まり（specs/001-career-and-project/spec.md の FR-001〜FR-006・FR-041）。
 * 使い手は career・project・organization の機能と、002 の職務経歴書
 * （specs/001-career-and-project/research.md の R9・R10）。
 */

import type { ActionResult } from '@/shared/domain/action-result';
import type { Uid } from '@/shared/domain/uid';

export type OrganizationId = number;

export type Organization = {
  id: OrganizationId;
  /** 管理画面の URL とフォームで組織を指す識別子 */
  uid: Uid;
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

/**
 * 職歴・実績の保存の内容が、組織名の指す組織を指してよいか（FR-001）。`organization` は
 * 組織名で読んだ組織で、無ければ null（保存のときに作る）。組織が秘匿化した組織名を
 * 持たなければ、入力した秘匿化した組織名を入れて保存するため、それで判定する。
 * 使い手は project と career の保存のユースケース
 */
export const canSaveWithOrganization = (
  organization: Pick<Organization, 'nameMasked'> | null,
  content: { isMasked: boolean; organizationNameMasked: string | null },
): boolean =>
  canBeReferencedAs(
    { nameMasked: organization?.nameMasked ?? content.organizationNameMasked },
    { isMasked: content.isMasked },
  );

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
  /** 管理画面の URL とフォームの uid が指す組織の id。無ければ null */
  findIdByUid: (uid: Uid) => Promise<OrganizationId | null>;
  /** 組織の一覧。名前の順 */
  list: () => Promise<Organization[]>;
  /** 職歴・実績がこの組織を指しているか。秘匿化した職歴・実績が指しているかも返す */
  findReferences: (
    id: OrganizationId,
  ) => Promise<{ isReferenced: boolean; isReferencedByMasked: boolean }>;
  /**
   * 組織名と秘匿化した組織名を直す（FR-004）。秘匿化した職歴・実績が指しているのに
   * 秘匿化した組織名を空にする書き込みは、SQL の条件でも止める（FR-001）
   */
  edit: (
    id: OrganizationId,
    values: { name: string; nameMasked: string | null },
  ) => Promise<
    { ok: true } | { ok: false; reason: 'name-taken' | 'masked-name-required' | 'not-found' }
  >;
  /**
   * 組織を消す。職歴・実績が指している組織と個人の組織は消さない（FR-006・FR-041）。
   * どちらの条件も SQL で確かめる
   */
  delete: (
    id: OrganizationId,
  ) => Promise<{ ok: true } | { ok: false; reason: 'referenced' | 'personal' | 'not-found' }>;
};

/** 組織のフォームが、入力の項目とは別に送る値 */
export const ORGANIZATION_UID_FIELD = 'organizationUid';

export type OrganizationField = 'name' | 'nameMasked';
export type OrganizationFieldError = 'missing' | 'name-taken' | 'masked-name-required';
export type OrganizationFormValues = Record<OrganizationField, string>;

/** 組織のフォームの Server Action が返す結果 */
export type OrganizationFormResult = ActionResult<OrganizationField, OrganizationFieldError>;

/** 組織を消す確認のフォームの Server Action が返す結果 */
export type DeleteOrganizationResult = { status: 'forbidden' | 'referenced' | 'personal' };
