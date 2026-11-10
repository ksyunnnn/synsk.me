import 'server-only';

import type { Validators } from '@/features/activity/domain/fetched-item';

/**
 * 条件付きの要求（specs/004-external-activity/research.md の R9）。前の取得で持った値を要求の
 * ヘッダにし、応答のヘッダから次に持つ値を読む。使い手は 1 本の要求で取得を終える取得元
 * （Zenn・Medium・Speaker Deck・1 頁で取り切った Qiita・GitHub）
 */

/** 前の値から要求のヘッダを作る。ETag があれば `If-None-Match`、無ければ `If-Modified-Since` */
export const conditionalHeaders = (previous?: Validators | null): Record<string, string> => {
  if (previous?.etag) return { 'If-None-Match': previous.etag };
  if (previous?.lastModified) return { 'If-Modified-Since': previous.lastModified };
  return {};
};

/** 応答のヘッダから次に持つ値を読む。どちらも無ければ持たない（undefined） */
export const validatorsOf = (headers: Headers): Validators | undefined => {
  const etag = headers.get('ETag');
  const lastModified = headers.get('Last-Modified');
  return etag || lastModified
    ? { etag: etag || null, lastModified: lastModified || null }
    : undefined;
};
