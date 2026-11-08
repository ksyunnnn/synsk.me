'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import {
  deleteActivity as deleteActivityUseCase,
  editActivity as editActivityUseCase,
} from '@/features/activity/application/edit-activity';
import {
  deleteLifeEvent as deleteLifeEventUseCase,
  editLifeEvent as editLifeEventUseCase,
  registerLifeEvent as registerLifeEventUseCase,
} from '@/features/activity/application/life-events';
import { registerActivity as registerActivityUseCase } from '@/features/activity/application/register-activity';
import {
  ACTIVITY_FIELDS,
  ACTIVITY_UID_FIELD,
  type ActivityFormResult,
} from '@/features/activity/domain/activity';
import {
  LIFE_EVENT_FIELDS,
  LIFE_EVENT_UID_FIELD,
  type LifeEventFormResult,
} from '@/features/activity/domain/life-event';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';
import { createActivityDeps } from './queries';

/**
 * 外部の activity と life event のフォームが呼ぶ Server Action。`page.tsx` が読み込み、フォームの
 * 部品に props で渡す（ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先にオーナーであることを確かめる（ADR-0036）。オーナーでなければ、外へ
 * 要求を出さず、入力した値を返さない
 */

/** 外部の activity を登録し、編集の画面へ移る */
export const registerActivity = async (
  _state: ActivityFormResult | null,
  formData: FormData,
): Promise<ActivityFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const outcome = await registerActivityUseCase(
    await createActivityDeps(),
    author,
    readValues(formData, ACTIVITY_FIELDS),
  );
  if (outcome.status === 'registered') redirect(`/dash/activities/${outcome.uid}?saved=1`);
  return outcome;
};

/** 外部の activity を書き換え、同じ画面へ移る */
export const editActivity = async (
  _state: ActivityFormResult | null,
  formData: FormData,
): Promise<ActivityFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { activities } = await createActivityDeps();
  const uid = readString(formData, ACTIVITY_UID_FIELD);
  const id = await findIdByUid(activities, uid);
  if (id === null) redirect('/dash/activities');

  const outcome = await editActivityUseCase(
    activities,
    author,
    id,
    readValues(formData, ACTIVITY_FIELDS),
  );
  if (outcome.status === 'saved') redirect(`/dash/activities/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/activities');
  return outcome;
};

export type DeleteActivityResult = { status: 'forbidden' | 'not-deletable' };

/** 外部の activity を削除し、一覧の画面へ移る。確認の画面のフォームが呼ぶ */
export const deleteActivity = async (
  _state: DeleteActivityResult | null,
  formData: FormData,
): Promise<DeleteActivityResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { activities } = await createActivityDeps();
  const id = await findIdByUid(activities, readString(formData, ACTIVITY_UID_FIELD));
  if (id === null) redirect('/dash/activities');

  const outcome = await deleteActivityUseCase(activities, author, id);
  if (outcome.status === 'forbidden' || outcome.status === 'not-deletable') return outcome;
  redirect('/dash/activities?deleted=1');
};

/** life event を作り、編集の画面へ移る */
export const registerLifeEvent = async (
  _state: LifeEventFormResult | null,
  formData: FormData,
): Promise<LifeEventFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const outcome = await registerLifeEventUseCase(
    (await createActivityDeps()).lifeEvents,
    author,
    readValues(formData, LIFE_EVENT_FIELDS),
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
  const { lifeEvents } = await createActivityDeps();
  const uid = readString(formData, LIFE_EVENT_UID_FIELD);
  const id = await findIdByUid(lifeEvents, uid);
  if (id === null) redirect('/dash/life-events');

  const outcome = await editLifeEventUseCase(
    lifeEvents,
    author,
    id,
    readValues(formData, LIFE_EVENT_FIELDS),
  );
  if (outcome.status === 'saved') redirect(`/dash/life-events/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/life-events');
  return outcome;
};

/** life event を削除し、一覧の画面へ移る */
export const deleteLifeEvent = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { lifeEvents } = await createActivityDeps();
  const id = await findIdByUid(lifeEvents, readString(formData, LIFE_EVENT_UID_FIELD));
  if (id === null) redirect('/dash/life-events');

  const outcome = await deleteLifeEventUseCase(lifeEvents, author, id);
  if (outcome.status === 'forbidden') return outcome;
  redirect('/dash/life-events?deleted=1');
};
