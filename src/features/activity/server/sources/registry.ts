import 'server-only';

import type { ActivityDeps, GoneChecker } from '@/features/activity/application/deps';
import type { UrlFetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  isListSourceName,
  isUrlSourceName,
  type ListSourceName,
  type UrlSourceName,
} from '@/features/activity/domain/sources';
import { fetchByUrl as fetchCodeSandbox } from '@/features/activity/server/sources/codesandbox';
import { fetchListing as fetchConnpass } from '@/features/activity/server/sources/connpass';
import { fetchByUrl as fetchSpotify } from '@/features/activity/server/sources/spotify';
import { fetchByUrl as fetchX } from '@/features/activity/server/sources/x';
import { fetchByUrl as fetchYouTube } from '@/features/activity/server/sources/youtube';
import { fetchListing as fetchDevto } from '@/features/activity/server/sources/devto';
import type { Fetcher } from '@/features/activity/server/sources/fetch-with-limits';
import { fetchListing as fetchGitHub } from '@/features/activity/server/sources/github';
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
 * 取得のユースケースが受け取る `fetchListing` と `goneCheckOf` の形にする
 */

type Listing = ActivityDeps['fetchListing'];
type ListingOf = (
  ...args: Parameters<Listing> extends [unknown, ...infer Rest] ? Rest : never
) => ReturnType<Listing>;

export const createSourceRegistry = (fetcher: Fetcher, env: SourceCredentialEnv) => {
  const listings: Record<ListSourceName, ListingOf> = {
    zenn: (limits, previous) => fetchZenn(fetcher, limits, previous),
    qiita: (limits, previous) => fetchQiita(fetcher, limits, env.QIITA_ACCESS_TOKEN, previous),
    devto: (limits) => fetchDevto(fetcher, limits),
    medium: (limits, previous) => fetchMedium(fetcher, limits, previous),
    github: (limits, previous) => fetchGitHub(fetcher, limits, env.GITHUB_TOKEN, previous),
    speakerdeck: (limits, previous) => fetchSpeakerDeck(fetcher, limits, previous),
    connpass: (limits) => fetchConnpass(fetcher, limits, env.CONNPASS_API_KEY),
  };
  const goneChecks: Partial<Record<ListSourceName, GoneChecker>> = {
    zenn: (url, limits) => checkZennGone(fetcher, url, limits),
    speakerdeck: (url, limits) => checkSpeakerDeckGone(fetcher, url, limits),
  };

  const byUrl: Record<
    UrlSourceName,
    (url: string, limits: FetchLimits) => Promise<UrlFetchedItem | null>
  > = {
    spotify: (url, limits) => fetchSpotify(fetcher, url, limits),
    youtube: (url, limits) => fetchYouTube(fetcher, url, limits),
    codesandbox: (url, limits) => fetchCodeSandbox(fetcher, url, limits),
    x: (url, limits) => fetchX(fetcher, url, limits),
  };

  const listingOf = (source: string) => (isListSourceName(source) ? listings[source] : undefined);

  return {
    hasListing: (source: string) => listingOf(source) !== undefined,
    fetchListing: ((source, limits, previous = null) => {
      const listing = listingOf(source);
      if (!listing) {
        return Promise.reject(new Error(`一覧を取る取得元でない: ${source}`));
      }
      return listing(limits, previous);
    }) satisfies Listing,
    /** 確かめる手段を持たない取得元は undefined。取得のユースケースは確かめない */
    goneCheckOf: (source: string): GoneChecker | undefined =>
      isListSourceName(source) ? goneChecks[source] : undefined,
    /** URL を指名する取得元の 1 つの URL から題などを取る。ほかの取得元には要求を出さず投げる */
    fetchByUrl: (source: string, url: string, limits: FetchLimits) => {
      const fetchOne = isUrlSourceName(source) ? byUrl[source] : undefined;
      if (!fetchOne) return Promise.reject(new Error(`URL を指名する取得元でない: ${source}`));
      return fetchOne(url, limits);
    },
  };
};
