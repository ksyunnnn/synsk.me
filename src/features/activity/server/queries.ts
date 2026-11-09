import 'server-only';

import { cache } from 'react';
import { getVisitorLifeEvent as getVisitorLifeEventUseCase } from '@/features/activity/application/get-visitor-life-event';
import type {
  LifeEvent,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import { createD1LifeEventRepository } from '@/features/activity/server/d1-life-event-repository';
import { parseMediaStorageKey } from '@/shared/domain/media';
import { findIdByUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import { createMediaStorage, respondWithMedia } from '@/shared/server/media-storage';

/**
 * activity の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createLifeEventRepository = async (): Promise<LifeEventRepository> =>
  createD1LifeEventRepository((await readEnv()).DB);

/**
 * 訪問者に見せる life event。無い識別子なら null。ページの本体とメタデータの両方が呼ぶため、
 * 1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorLifeEvent = cache(async (slug: string): Promise<VisitorLifeEvent | null> =>
  getVisitorLifeEventUseCase(await createLifeEventRepository(), slug),
);

/** オーナーの一覧。オーナーでなければ 403 */
export const listLifeEvents = async (): Promise<LifeEventSummary[]> => {
  await requireAuthor();
  return (await createLifeEventRepository()).list();
};

/** オーナーが編集する life event。オーナーでなければ 403。無い uid なら null */
export const getLifeEventForEdit = async (uid: string): Promise<LifeEvent | null> => {
  await requireAuthor();
  const lifeEvents = await createLifeEventRepository();
  const id = await findIdByUid(lifeEvents, uid);
  return id === null ? null : lifeEvents.findForEdit(id);
};

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。題や説明を読まず、有無だけを返す
 */

/** 訪問者に見せる life event がある識別子か。`getVisitorLifeEvent` が null を返さない識別子と一致する */
export const hasLifeEventSlug = async (slug: string): Promise<boolean> =>
  (await createLifeEventRepository()).hasSlug(slug);

/** オーナーが編集できる life event がある uid か。`getLifeEventForEdit` が null を返さない uid と一致する */
export const hasLifeEventUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid(await createLifeEventRepository(), uid)) !== null;

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
  const storageKey = parseMediaStorageKey(key);
  const isCard =
    storageKey !== null &&
    (await (await createLifeEventRepository()).isCardImage(slug, storageKey));
  return respondWithMedia(
    await createMediaStorage(),
    key,
    isCard ? 'public' : 'hidden',
    ifNoneMatch,
  );
};
