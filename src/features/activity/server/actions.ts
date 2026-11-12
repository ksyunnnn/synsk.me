'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteExternalActivity as deleteExternalActivityUseCase } from '@/features/activity/application/delete-external-activity';
import { deleteLifeEvent as deleteLifeEventUseCase } from '@/features/activity/application/delete-life-event';
import { editExternalActivity as editExternalActivityUseCase } from '@/features/activity/application/edit-external-activity';
import { editLifeEvent as editLifeEventUseCase } from '@/features/activity/application/edit-life-event';
import { registerExternalActivity as registerExternalActivityUseCase } from '@/features/activity/application/register-external-activity';
import {
  EXTERNAL_ACTIVITY_FIELDS,
  EXTERNAL_ACTIVITY_UID_FIELD,
  type ExternalActivityFormResult,
  type ExternalActivityFormValues,
} from '@/features/activity/domain/external-activity';
import {
  registerLifeEventImage as registerLifeEventImageUseCase,
  removeLifeEventImage as removeLifeEventImageUseCase,
} from '@/features/activity/application/life-event-image';
import { registerLifeEvent as registerLifeEventUseCase } from '@/features/activity/application/register-life-event';
import {
  LIFE_EVENT_FIELDS,
  LIFE_EVENT_IMAGE_FIELD,
  LIFE_EVENT_UID_FIELD,
  type LifeEventFormResult,
  type LifeEventImageResult,
  type LifeEventFormValues,
} from '@/features/activity/domain/life-event';
import { createActivityDeps } from '@/features/activity/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';
import { routes } from '@/shared/routes';

/**
 * life event のフォームが呼ぶ Server Action（specs/004-external-activity/contracts/dash.md）。
 * `page.tsx` が読み込み、フォームの部品に props で渡す（ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先にオーナーであることを確かめる（ユースケースの先頭）。Server Action は
 * 経路に縛られず、`/dash` の外への POST からも呼べるため（ADR-0036、FR-031）。
 * オーナーでなければ、入力した値を返さない
 */

const readLifeEventValues = (formData: FormData): LifeEventFormValues =>
  readValues(formData, LIFE_EVENT_FIELDS);

/** life event を作り、編集の画面へ移る */
export const registerLifeEvent = async (
  _state: LifeEventFormResult | null,
  formData: FormData,
): Promise<LifeEventFormResult> => {
  const outcome = await registerLifeEventUseCase(
    (await createActivityDeps()).lifeEvents,
    await getCurrentAuthor(),
    readLifeEventValues(formData),
  );
  if (outcome.status === 'registered')
    redirect(`${routes.dash.lifeEvents.row(outcome.uid)}?saved=1`);
  return outcome;
};

/** life event を書き換え、同じ画面へ移る */
export const editLifeEvent = async (
  _state: LifeEventFormResult | null,
  formData: FormData,
): Promise<LifeEventFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { lifeEvents } = await createActivityDeps();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect(routes.dash.lifeEvents.list);

  const outcome = await editLifeEventUseCase(lifeEvents, author, id, readLifeEventValues(formData));
  if (outcome.status === 'saved') redirect(`${routes.dash.lifeEvents.row(uid)}?saved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.lifeEvents.list);
  return outcome;
};

/** life event を消し、一覧の画面へ移る。確認の画面（`/dash/life-events/{uid}/delete`）のフォームが呼ぶ */
export const deleteLifeEvent = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { lifeEvents, media } = await createActivityDeps();
  const id = await findIdByUid(lifeEvents, readString(formData, LIFE_EVENT_UID_FIELD));
  if (id === null) redirect(routes.dash.lifeEvents.list);

  const outcome = await deleteLifeEventUseCase(lifeEvents, media, author, id);
  if (outcome.status === 'forbidden') return outcome;
  redirect(`${routes.dash.lifeEvents.list}?deleted=1`);
};

const readExternalActivityValues = (formData: FormData): ExternalActivityFormValues =>
  readValues(formData, EXTERNAL_ACTIVITY_FIELDS);

/**
 * URL を指名した・手で入力した外部の activity を登録し、一覧の画面へ移る（FR-009・FR-010）。
 * オーナーでなければ外へ要求を出さない（ユースケースの先頭）
 */
export const registerExternalActivity = async (
  _state: ExternalActivityFormResult | null,
  formData: FormData,
): Promise<ExternalActivityFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { externalActivities, fetchByUrl } = await createActivityDeps();
  const outcome = await registerExternalActivityUseCase(
    externalActivities,
    fetchByUrl,
    author,
    readExternalActivityValues(formData),
  );
  if (outcome.status === 'registered') redirect(`${routes.dash.activities.list}?saved=1`);
  return outcome;
};

/** 外部の activity を書き換え、同じ画面へ移る */
export const editExternalActivity = async (
  _state: ExternalActivityFormResult | null,
  formData: FormData,
): Promise<ExternalActivityFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { externalActivities: activities } = await createActivityDeps();
  const uid = readString(formData, EXTERNAL_ACTIVITY_UID_FIELD);
  const id = await findIdByUid(activities, uid);
  if (id === null) redirect(routes.dash.activities.list);

  const outcome = await editExternalActivityUseCase(
    activities,
    author,
    id,
    readExternalActivityValues(formData),
  );
  if (outcome.status === 'saved') redirect(`${routes.dash.activities.row(uid)}?saved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.activities.list);
  return outcome;
};

/** 外部の activity を消し、一覧の画面へ移る（FR-033）。確認の画面のフォームが呼ぶ */
export const deleteExternalActivity = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { externalActivities: activities } = await createActivityDeps();
  const id = await findIdByUid(activities, readString(formData, EXTERNAL_ACTIVITY_UID_FIELD));
  if (id === null) redirect(routes.dash.activities.list);

  const outcome = await deleteExternalActivityUseCase(activities, author, id);
  if (outcome.status === 'forbidden') return outcome;
  redirect(`${routes.dash.activities.list}?deleted=1`);
};

/**
 * life event の代表画像を登録し、同じ画面へ移る（FR-028）。前の画像は消える。形式と大きさは
 * 共有担当の置き場が確かめる（U5 の決定）
 */
export const registerLifeEventImage = async (
  _state: LifeEventImageResult | null,
  formData: FormData,
): Promise<LifeEventImageResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { lifeEvents, media } = await createActivityDeps();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect(routes.dash.lifeEvents.list);

  const file = formData.get(LIFE_EVENT_IMAGE_FIELD);
  const outcome = await registerLifeEventImageUseCase(
    lifeEvents,
    media,
    author,
    id,
    file instanceof Blob ? file : new Blob([]),
  );
  if (outcome.status === 'saved') redirect(`${routes.dash.lifeEvents.row(uid)}?imageSaved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.lifeEvents.list);
  return outcome;
};

/** life event の代表画像を外し、同じ画面へ移る */
export const removeLifeEventImage = async (
  _state: LifeEventImageResult | null,
  formData: FormData,
): Promise<LifeEventImageResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { lifeEvents, media } = await createActivityDeps();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect(routes.dash.lifeEvents.list);

  const outcome = await removeLifeEventImageUseCase(
    lifeEvents,
    media,
    author,
    id,
  );
  if (outcome.status === 'saved') redirect(`${routes.dash.lifeEvents.row(uid)}?imageRemoved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.lifeEvents.list);
  return outcome;
};
