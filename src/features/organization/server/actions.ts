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
import { createOrganizationRepository } from '@/features/organization/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import type { ActionResult } from '@/shared/domain/action-result';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString } from '@/shared/server/form-data';

/**
 * 組織のフォームが呼ぶ Server Action。何より先にオーナーであることを確かめる（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

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
  const id = await findIdByUid(organizations, uid);
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
  const id = await findIdByUid(organizations, readString(formData, ORGANIZATION_UID_FIELD));
  if (id === null) redirect('/dash/organizations');

  const outcome = await deleteOrganizationUseCase(organizations, author, id);
  if (outcome.status === 'deleted' || outcome.status === 'not-found') {
    redirect('/dash/organizations?deleted=1');
  }
  return outcome;
};
