'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteOrganization as deleteOrganizationUseCase } from '@/features/organization/application/delete-organization';
import {
  ORGANIZATION_UID_FIELD,
  editOrganization as editOrganizationUseCase,
  type OrganizationField,
  type OrganizationFieldError,
} from '@/features/organization/application/edit-organization';
import {
  createOrganizationRepository,
  findOrganizationId,
} from '@/features/organization/server/queries';
import type { ActionResult } from '@/shared/domain/action-result';
import { getCurrentAuthor } from '@/shared/server/author';

/**
 * 組織のフォームが呼ぶ Server Action。何より先に作り手であることを確かめる（ADR-0036）。
 * 作り手でなければ、入力した値を返さない
 */

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

export type OrganizationFormResult = ActionResult<OrganizationField, OrganizationFieldError>;

/** 組織を直し、同じ画面へ移る */
export const editOrganization = async (
  _state: OrganizationFormResult | null,
  formData: FormData,
): Promise<OrganizationFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const organizations = await createOrganizationRepository();
  const uid = readString(formData, ORGANIZATION_UID_FIELD);
  const id = await findOrganizationId(organizations, uid);
  if (id === null) redirect('/dash/organizations');

  const outcome = await editOrganizationUseCase(organizations, author, id, {
    name: readString(formData, 'name'),
    nameMasked: readString(formData, 'nameMasked'),
  });
  if (outcome.status === 'saved') redirect(`/dash/organizations/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/organizations');
  return outcome;
};

export type DeleteOrganizationResult = { status: 'forbidden' | 'referenced' | 'personal' };

/** 組織を消し、一覧の画面へ移る。消せなければ、確認の画面に理由を返す */
export const deleteOrganization = async (
  _state: DeleteOrganizationResult | null,
  formData: FormData,
): Promise<DeleteOrganizationResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const organizations = await createOrganizationRepository();
  const id = await findOrganizationId(organizations, readString(formData, ORGANIZATION_UID_FIELD));
  if (id === null) redirect('/dash/organizations');

  const outcome = await deleteOrganizationUseCase(organizations, author, id);
  if (outcome.status === 'deleted' || outcome.status === 'not-found') {
    redirect('/dash/organizations?deleted=1');
  }
  return outcome;
};
