import 'server-only';

import { acceptItems, type FetchOutcome } from '@/features/activity/domain/fetched-item';
import type { ListSource } from '@/features/activity/domain/source';
import type { ActivityEnv } from '@/shared/server/env';
import { getText, parseJson, recordOf, stringOf, type Http } from './http';
import { firstImageSource, readRssItems } from './rss';

/**
 * 一覧を取る取得元の取り方（specs/004-external-activity/research.md の R3・R4）。
 *
 * 各関数は外部の応答をその場で `FetchedItem` に詰め替え、外部の応答の型を外に出さない
 * （docs/SOFTWARE_DESIGN.md の Anti-Corruption Layer）。失敗は投げずに `ok: false` で返す
 * （「失敗の表し方」）。取る先と値の取り方は PR #47 の検証記録
 * （`docs/scraps/external-api-verification.md`、2026-09-02 実測）による
 */

/** 取る先のアカウント名。取る先は D1 に持たずコードに持つ（spec の FR-004） */
const ACCOUNT = 'ksyunnnn';

/** 1 ページの件数。返った件数がこれより少なければ、一覧はすべての項目を含む */
const PAGE_SIZE = 100;

export type ListFetcher = (http: Http, env: ActivityEnv) => Promise<FetchOutcome>;

const fail = (reason: string): FetchOutcome => ({ ok: false, reason });

const jsonArray = (text: string): unknown[] | null => {
  const value = parseJson(text);
  return Array.isArray(value) ? value : null;
};

/** Zenn の RSS。20 件で固定のため、一覧はすべての項目を含まない */
const fetchZenn: ListFetcher = async (http) => {
  const response = await getText(http, `https://zenn.dev/${ACCOUNT}/feed`);
  if (!response.ok) return fail(response.reason);
  const { items, skipped } = acceptItems(
    readRssItems(response.text).map((item) => ({
      // guid は link と同じ値で、ID を返さない。URL で判定する
      externalId: null,
      url: item.text('link'),
      title: item.text('title'),
      publishedAt: item.text('pubDate'),
      imageUrl: item.attribute('enclosure', 'url'),
    })),
  );
  return { ok: true, items, isComplete: false, skipped };
};

/** Medium の RSS。10 件で固定。`link` は問い合わせの部分を外して使う */
const fetchMedium: ListFetcher = async (http) => {
  const response = await getText(http, `https://medium.com/feed/@${ACCOUNT}`);
  if (!response.ok) return fail(response.reason);
  const { items, skipped } = acceptItems(
    readRssItems(response.text).map((item) => ({
      externalId: item.text('guid'),
      url: item.text('link')?.replace(/\?.*$/, ''),
      title: item.text('title'),
      publishedAt: item.text('pubDate'),
      imageUrl: firstImageSource(item.text('content:encoded')),
    })),
  );
  return { ok: true, items, isComplete: false, skipped };
};

/** Speaker Deck の RSS。件数の決まりが公式に無いため、すべての項目を含むとみなさない */
const fetchSpeakerDeck: ListFetcher = async (http) => {
  const response = await getText(http, `https://speakerdeck.com/${ACCOUNT}.rss`);
  if (!response.ok) return fail(response.reason);
  const { items, skipped } = acceptItems(
    readRssItems(response.text).map((item) => ({
      externalId: null,
      url: item.text('link'),
      title: item.text('title'),
      publishedAt: item.text('pubDate'),
      imageUrl: item.attribute('media:content', 'url'),
    })),
  );
  return { ok: true, items, isComplete: false, skipped };
};

/** Qiita の REST。総数はヘッダ `total-count` で分かる */
const fetchQiita: ListFetcher = async (http, env) => {
  const response = await getText(
    http,
    `https://qiita.com/api/v2/users/${ACCOUNT}/items?per_page=${PAGE_SIZE}&page=1`,
    env.QIITA_ACCESS_TOKEN ? { authorization: `Bearer ${env.QIITA_ACCESS_TOKEN}` } : {},
  );
  if (!response.ok) return fail(response.reason);
  const rows = jsonArray(response.text);
  if (!rows) return fail('応答が一覧の形でない');
  const { items, skipped } = acceptItems(
    rows.map(recordOf).map((row) => ({
      externalId: stringOf(row?.id),
      url: stringOf(row?.url),
      title: stringOf(row?.title),
      // 公開日の専用の項目は無く、created_at を使う
      publishedAt: stringOf(row?.created_at),
      imageUrl: null,
    })),
  );
  const total = Number(response.headers.get('total-count') ?? Number.NaN);
  return { ok: true, items, isComplete: total <= rows.length, skipped };
};

/** dev.to の REST */
const fetchDevto: ListFetcher = async (http) => {
  const response = await getText(
    http,
    `https://dev.to/api/articles?username=${ACCOUNT}&per_page=${PAGE_SIZE}`,
  );
  if (!response.ok) return fail(response.reason);
  const rows = jsonArray(response.text);
  if (!rows) return fail('応答が一覧の形でない');
  const { items, skipped } = acceptItems(
    rows.map(recordOf).map((row) => ({
      externalId: stringOf(row?.id),
      url: stringOf(row?.url),
      title: stringOf(row?.title),
      publishedAt: stringOf(row?.published_at),
      imageUrl: stringOf(row?.cover_image) ?? stringOf(row?.social_image),
    })),
  );
  return { ok: true, items, isComplete: rows.length < PAGE_SIZE, skipped };
};

/** GitHub の REST。フォークしたリポジトリは取り込まない */
const fetchGitHub: ListFetcher = async (http, env) => {
  const response = await getText(
    http,
    `https://api.github.com/users/${ACCOUNT}/repos?type=owner&sort=created&direction=desc&per_page=${PAGE_SIZE}`,
    {
      accept: 'application/vnd.github+json',
      ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    },
  );
  if (!response.ok) return fail(response.reason);
  const rows = jsonArray(response.text);
  if (!rows) return fail('応答が一覧の形でない');
  const { items, skipped } = acceptItems(
    rows
      .map(recordOf)
      .filter((row) => row?.fork !== true)
      .map((row) => ({
        externalId: stringOf(row?.id),
        url: stringOf(row?.html_url),
        title: stringOf(row?.name),
        publishedAt: stringOf(row?.created_at),
        imageUrl: null,
      })),
  );
  return { ok: true, items, isComplete: rows.length < PAGE_SIZE, skipped };
};

/** connpass の REST。API キーが要る。無ければ取らない */
const fetchConnpass: ListFetcher = async (http, env) => {
  if (!env.CONNPASS_API_KEY) return fail('API キー（CONNPASS_API_KEY）が無い');
  const response = await getText(
    http,
    `https://connpass.com/api/v2/users/${ACCOUNT}/attended_events/?count=${PAGE_SIZE}`,
    { 'x-api-key': env.CONNPASS_API_KEY },
  );
  if (!response.ok) return fail(response.reason);
  const body = recordOf(parseJson(response.text));
  const events = body?.events;
  if (!body || !Array.isArray(events)) return fail('応答が一覧の形でない');
  const { items, skipped } = acceptItems(
    events.map(recordOf).map((event) => ({
      externalId: stringOf(event?.id),
      url: stringOf(event?.url),
      title: stringOf(event?.title),
      publishedAt: stringOf(event?.started_at),
      imageUrl: null,
    })),
  );
  const available = Number(body.results_available);
  return { ok: true, items, isComplete: available <= events.length, skipped };
};

/** 取得元ごとの取り方 */
export const LIST_FETCHERS: Record<ListSource, ListFetcher> = {
  zenn_article: fetchZenn,
  qiita_article: fetchQiita,
  devto_article: fetchDevto,
  medium_article: fetchMedium,
  github_repository: fetchGitHub,
  speakerdeck_deck: fetchSpeakerDeck,
  connpass_event: fetchConnpass,
};
