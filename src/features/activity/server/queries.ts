import 'server-only';

import { cache } from 'react';
import {
  getActivityForEdit as getActivityForEditUseCase,
  listActivities as listActivitiesUseCase,
} from '@/features/activity/application/list-activities';
import {
  getLifeEventForEdit as getLifeEventForEditUseCase,
  getVisitorLifeEvent as getVisitorLifeEventUseCase,
  listLifeEvents as listLifeEventsUseCase,
} from '@/features/activity/application/life-events';
import { listFeed as listFeedUseCase } from '@/features/activity/application/list-feed';
import type { ExternalActivity, FetchResult } from '@/features/activity/domain/activity';
import type { FeedPage } from '@/features/activity/domain/feed';
import type {
  LifeEvent,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import { findIdByUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import { createActivityDeps as createDeps } from './deps';

/**
 * activity の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createActivityDeps = async () => createDeps(await readEnv());

/**
 * 訪問者の一覧（timeline）の `page` ページ目（specs/005-feed/contracts/visitor-feed.md）。
 * 誰が要求しても同じ値を返す。オーナーを確かめない
 */
export const listFeed = async (page: number): Promise<FeedPage> =>
  listFeedUseCase((await createActivityDeps()).feed, page);

/** 管理画面の一覧と、取得元ごとの取得の結果。オーナーでなければ 403 */
export const listActivities = async (): Promise<{
  activities: ExternalActivity[];
  fetchResults: FetchResult[];
}> => {
  await requireAuthor();
  return listActivitiesUseCase((await createActivityDeps()).activities);
};

/** オーナーが開く外部の activity。オーナーでなければ 403。無い uid なら null */
export const getActivityForEdit = async (uid: string): Promise<ExternalActivity | null> => {
  await requireAuthor();
  const { activities } = await createActivityDeps();
  const id = await findIdByUid(activities, uid);
  return id === null ? null : getActivityForEditUseCase(activities, id);
};

/** オーナーの life event の一覧。オーナーでなければ 403 */
export const listLifeEvents = async (): Promise<LifeEventSummary[]> => {
  await requireAuthor();
  return listLifeEventsUseCase((await createActivityDeps()).lifeEvents);
};

/** オーナーが編集する life event。オーナーでなければ 403。無い uid なら null */
export const getLifeEventForEdit = async (uid: string): Promise<LifeEvent | null> => {
  await requireAuthor();
  const { lifeEvents } = await createActivityDeps();
  const id = await findIdByUid(lifeEvents, uid);
  return id === null ? null : getLifeEventForEditUseCase(lifeEvents, id);
};

/**
 * 訪問者に見せる life event。無い識別子なら null。ページの本体とメタデータの両方が呼ぶため、
 * 1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorLifeEvent = cache(async (slug: string): Promise<VisitorLifeEvent | null> =>
  getVisitorLifeEventUseCase((await createActivityDeps()).lifeEvents, slug),
);

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。題を読まず、有無だけを返す
 */

/** 訪問者に見せる life event がある識別子か。`getVisitorLifeEvent` が null を返さない識別子と一致する */
export const hasLifeEventSlug = async (slug: string): Promise<boolean> =>
  (await createActivityDeps()).lifeEvents.hasSlug(slug);

/** オーナーが開ける外部の activity がある uid か */
export const hasActivityUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createActivityDeps()).activities, uid)) !== null;

/** オーナーが編集できる life event がある uid か */
export const hasLifeEventUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createActivityDeps()).lifeEvents, uid)) !== null;
