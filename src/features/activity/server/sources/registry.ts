import 'server-only';

import type { ActivityDeps } from '@/features/activity/application/deps';
import type { GoneCheck } from '@/features/activity/domain/fetched-item';
import { isListSourceName, type ListSourceName } from '@/features/activity/domain/sources';
import { fetchListing as fetchConnpass } from '@/features/activity/server/sources/connpass';
import { fetchListing as fetchDevto } from '@/features/activity/server/sources/devto';
import type { Fetcher } from '@/features/activity/server/sources/fetch-with-limits';
import { fetchListing as fetchMedium } from '@/features/activity/server/sources/medium';
import { fetchListing as fetchQiita } from '@/features/activity/server/sources/qiita';
import {
  checkGone as checkSpeakerDeckGone,
  fetchListing as fetchSpeakerDeck,
} from '@/features/activity/server/sources/speakerdeck';
import {
  checkGone as checkZennGone,
  fetchListing as fetchZenn,
} from '@/features/activity/server/sources/zenn';
import type { SourceCredentialEnv } from '@/shared/server/env';

/**
 * 取得元の名前（`src/features/activity/domain/sources.ts`）から、取得元ごとの処理を引く
 * （specs/004-external-activity/research.md の R3）。認証情報は secret から渡す（R15）。
 * 取得のユースケースが受け取る `fetchListing` と `checkGone` の形にする
 */

type Listing = ActivityDeps['fetchListing'];
type ListingOf = (
  ...args: Parameters<Listing> extends [unknown, ...infer Rest] ? Rest : never
) => ReturnType<Listing>;

export const createSourceRegistry = (fetcher: Fetcher, env: SourceCredentialEnv) => {
  /** GitHub は公開日の扱いの答え（plan.md の未決）を待つので、まだ処理を持たない */
  const listings: Partial<Record<ListSourceName, ListingOf>> = {
    zenn: (limits, previous) => fetchZenn(fetcher, limits, previous),
    qiita: (limits, previous) => fetchQiita(fetcher, limits, env.QIITA_ACCESS_TOKEN, previous),
    devto: (limits) => fetchDevto(fetcher, limits),
    medium: (limits, previous) => fetchMedium(fetcher, limits, previous),
    speakerdeck: (limits, previous) => fetchSpeakerDeck(fetcher, limits, previous),
    connpass: (limits) => fetchConnpass(fetcher, limits, env.CONNPASS_API_KEY),
  };
  const goneChecks: Partial<Record<ListSourceName, NonNullable<ActivityDeps['checkGone']>>> = {
    zenn: (_source, url, limits) => checkZennGone(fetcher, url, limits),
    speakerdeck: (_source, url, limits) => checkSpeakerDeckGone(fetcher, url, limits),
  };

  const listingOf = (source: string) => (isListSourceName(source) ? listings[source] : undefined);

  return {
    hasListing: (source: string) => listingOf(source) !== undefined,
    fetchListing: ((source, limits, previous) => {
      const listing = listingOf(source);
      if (!listing) {
        return Promise.reject(
          new Error(
            source === 'github'
              ? 'GitHub の取得の処理はまだ無い（公開日の扱いの答えを待つ）'
              : `一覧を取る取得元でない: ${source}`,
          ),
        );
      }
      return listing(limits, previous);
    }) satisfies Listing,
    checkGone: (async (source, url, limits): Promise<GoneCheck> => {
      const check = isListSourceName(source) ? goneChecks[source] : undefined;
      return check ? check(source, url, limits) : 'unknown';
    }) satisfies NonNullable<ActivityDeps['checkGone']>,
  };
};
