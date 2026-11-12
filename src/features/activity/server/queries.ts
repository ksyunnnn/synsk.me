import 'server-only';

import { cache } from 'react';
import { listFeed } from '@/features/activity/application/list-feed';
import { refreshNextSources } from '@/features/activity/application/refresh-next-sources';
import { getVisitorLifeEvent as getVisitorLifeEventUseCase } from '@/features/activity/application/get-visitor-life-event';
import type { FetchByUrl } from '@/features/activity/application/register-external-activity';
import type { ExternalActivity } from '@/features/activity/domain/external-activity';
import type { FeedPage } from '@/features/activity/domain/feed';
import type { RefreshOutcome } from '@/features/activity/domain/fetched-item';
import { PRODUCTION_REFRESH_LIMITS, SOURCES_PER_RUN } from '@/features/activity/domain/limits';
import { LIST_SOURCES } from '@/features/activity/domain/sources';
import {
  createD1ActivityRepository,
  createD1ExternalActivityRepository,
} from '@/features/activity/server/d1-activity-repository';
import { createD1FeedRepository } from '@/features/activity/server/d1-feed-repository';
import { createSourceRegistry } from '@/features/activity/server/sources/registry';
import type {
  LifeEvent,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import { createD1LifeEventRepository } from '@/features/activity/server/d1-life-event-repository';
import { parseMediaStorageKey } from '@/shared/domain/media';
import { findIdByUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import { createMediaStorage, respondWithMedia, withNoindex } from '@/shared/server/media-storage';

/**
 * activity の画面・Server Action・`src/proxy.ts`・定期実行の入口が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createActivityDeps = async () => {
  const env = await readEnv();
  // 外への要求は Workers の `fetch` で出す
  const registry = createSourceRegistry((url, init) => fetch(url, init), env);
  /**
   * URL を指名する取得元の 1 つの URL から題などを取る。上限は取り直しと同じ本番の値
   * （src/features/activity/domain/limits.ts）
   */
  const fetchByUrl: FetchByUrl = (source, url) =>
    registry.fetchByUrl(source, url, PRODUCTION_REFRESH_LIMITS);
  return {
    activities: createD1ActivityRepository(env.DB),
    externalActivities: createD1ExternalActivityRepository(env.DB),
    lifeEvents: createD1LifeEventRepository(env.DB),
    feed: createD1FeedRepository(env.DB),
    media: await createMediaStorage(),
    fetchListing: registry.fetchListing,
    goneCheckOf: registry.goneCheckOf,
    fetchByUrl,
  };
};

/**
 * 定期実行の入口（worker/scheduled.ts）が呼ぶ。一覧を取る取得元から、本番の上限
 * （src/features/activity/domain/limits.ts）で次の取得元を取り直す
 */
export const refreshNextSourcesNow = async (now: string): Promise<RefreshOutcome[]> =>
  refreshNextSources(
    await createActivityDeps(),
    LIST_SOURCES,
    now,
    PRODUCTION_REFRESH_LIMITS,
    SOURCES_PER_RUN,
  );

/**
 * 訪問者に見せる一覧（specs/005-feed/contracts/visitor-feed.md）。ページの本体とメタデータの両方が
 * 呼ぶため、1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const listFeedItems = cache(async (page: number): Promise<FeedPage> =>
  listFeed((await createActivityDeps()).feed, page),
);

/**
 * 訪問者に見せる life event。無い識別子なら null。ページの本体とメタデータの両方が呼ぶため、
 * 1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorLifeEvent = cache(async (slug: string): Promise<VisitorLifeEvent | null> =>
  getVisitorLifeEventUseCase((await createActivityDeps()).lifeEvents, slug),
);

/** オーナーの一覧。オーナーでなければ 403 */
export const listLifeEvents = async (): Promise<LifeEventSummary[]> => {
  await requireAuthor();
  return (await createActivityDeps()).lifeEvents.list();
};

/** オーナーが編集する life event。オーナーでなければ 403。無い uid なら null */
export const getLifeEventForEdit = async (uid: string): Promise<LifeEvent | null> => {
  await requireAuthor();
  const { lifeEvents } = await createActivityDeps();
  const id = await findIdByUid(lifeEvents, uid);
  return id === null ? null : lifeEvents.findForEdit(id);
};

/** URL を指名した・手で入力した外部の activity のオーナーの一覧。オーナーでなければ 403 */
export const listExternalActivities = async (): Promise<ExternalActivity[]> => {
  await requireAuthor();
  return (await createActivityDeps()).externalActivities.list();
};

/** オーナーが編集する外部の activity。オーナーでなければ 403。無い uid なら null */
export const getExternalActivityForEdit = async (uid: string): Promise<ExternalActivity | null> => {
  await requireAuthor();
  const { externalActivities: activities } = await createActivityDeps();
  const id = await findIdByUid(activities, uid);
  return id === null ? null : activities.findForEdit(id);
};

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。題や説明を読まず、有無だけを返す
 */

/** オーナーが編集できる外部の activity がある uid か。`getExternalActivityForEdit` と一致する */
export const hasExternalActivityUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createActivityDeps()).externalActivities, uid)) !== null;

/** 訪問者に見せる life event がある識別子か。`getVisitorLifeEvent` が null を返さない識別子と一致する */
export const hasLifeEventSlug = async (slug: string): Promise<boolean> =>
  (await createActivityDeps()).lifeEvents.hasSlug(slug);

/** オーナーが編集できる life event がある uid か。`getLifeEventForEdit` が null を返さない uid と一致する */
export const hasLifeEventUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createActivityDeps()).lifeEvents, uid)) !== null;

/**
 * life event の代表画像の応答（contracts/visitor-life-event.md の「画像の経路」）。その識別子の
 * life event の代表画像のときだけ、公開の画像として返す。ほかの持ち主の画像・代表画像でない画像・
 * 形の違うキーは、置き場を読まずに 404（FR-029・FR-030）。life event は訪問者に見せない状態を
 * 持たない（FR-026）
 */
export const respondWithLifeEventImage = async (
  slug: string,
  key: string,
  ifNoneMatch: string | null,
): Promise<Response> => {
  const { lifeEvents, media } = await createActivityDeps();
  const storageKey = parseMediaStorageKey(key);
  const isCard = storageKey !== null && (await lifeEvents.isCardImage(slug, storageKey));
  return withNoindex(await respondWithMedia(media, key, isCard ? 'public' : 'hidden', ifNoneMatch));
};
