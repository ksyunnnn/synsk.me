'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteLifeEvent as deleteLifeEventUseCase } from '@/features/activity/application/delete-life-event';
import { editLifeEvent as editLifeEventUseCase } from '@/features/activity/application/edit-life-event';
import {
  registerLifeEventImage as registerLifeEventImageUseCase,
  removeLifeEventImage as removeLifeEventImageUseCase,
  type LifeEventImageOutcome,
} from '@/features/activity/application/life-event-image';
import { registerLifeEvent as registerLifeEventUseCase } from '@/features/activity/application/register-life-event';
import {
  LIFE_EVENT_FIELDS,
  LIFE_EVENT_IMAGE_FIELD,
  LIFE_EVENT_UID_FIELD,
  type LifeEventFormResult,
  type LifeEventFormValues,
} from '@/features/activity/domain/life-event';
import { createLifeEventRepository } from '@/features/activity/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { createMediaStorage } from '@/shared/server/media-storage';
import { readString, readValues } from '@/shared/server/form-data';

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
    await createLifeEventRepository(),
    await getCurrentAuthor(),
    readLifeEventValues(formData),
  );
  if (outcome.status === 'registered') redirect(`/dash/life-events/${outcome.uid}?saved=1`);
  return outcome;
};

/** life event を書き換え、同じ画面へ移る */
export const editLifeEvent = async (
  _state: LifeEventFormResult | null,
  formData: FormData,
): Promise<LifeEventFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const lifeEvents = await createLifeEventRepository();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect('/dash/life-events');

  const outcome = await editLifeEventUseCase(lifeEvents, author, id, readLifeEventValues(formData));
  if (outcome.status === 'saved') redirect(`/dash/life-events/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/life-events');
  return outcome;
};

/** life event を消し、一覧の画面へ移る。確認の画面（`/dash/life-events/{uid}/delete`）のフォームが呼ぶ */
export const deleteLifeEvent = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const lifeEvents = await createLifeEventRepository();
  const id = await findIdByUid(lifeEvents, readString(formData, LIFE_EVENT_UID_FIELD));
  if (id === null) redirect('/dash/life-events');

  const outcome = await deleteLifeEventUseCase(lifeEvents, await createMediaStorage(), author, id);
  if (outcome.status === 'forbidden') return outcome;
  redirect('/dash/life-events?deleted=1');
};

/** 画像の操作の結果。保存したら同じ画面へ移すので、画面に返すのは保存しなかったときだけ */
export type LifeEventImageResult = Exclude<
  LifeEventImageOutcome,
  { status: 'saved' | 'not-found' }
>;

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
  const lifeEvents = await createLifeEventRepository();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect('/dash/life-events');

  const file = formData.get(LIFE_EVENT_IMAGE_FIELD);
  const outcome = await registerLifeEventImageUseCase(
    lifeEvents,
    await createMediaStorage(),
    author,
    id,
    file instanceof Blob ? file : new Blob([]),
  );
  if (outcome.status === 'saved') redirect(`/dash/life-events/${uid}?imageSaved=1`);
  if (outcome.status === 'not-found') redirect('/dash/life-events');
  return outcome;
};

/** life event の代表画像を外し、同じ画面へ移る */
export const removeLifeEventImage = async (
  _state: LifeEventImageResult | null,
  formData: FormData,
): Promise<LifeEventImageResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const lifeEvents = await createLifeEventRepository();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect('/dash/life-events');

  const outcome = await removeLifeEventImageUseCase(
    lifeEvents,
    await createMediaStorage(),
    author,
    id,
  );
  if (outcome.status === 'saved') redirect(`/dash/life-events/${uid}?imageRemoved=1`);
  if (outcome.status === 'not-found') redirect('/dash/life-events');
  return outcome;
};
