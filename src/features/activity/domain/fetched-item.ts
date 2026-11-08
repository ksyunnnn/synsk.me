import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 取得元から取った 1 件を、synsk.me の形に詰め替えた値（specs/004-external-activity/research.md
 * の R4）。取得元ごとの関数（`server/sources/`）が、外部の応答をその場でこの形にする。外部の
 * 応答の型は、その関数の外に出さない（constitution VII）
 */
export type FetchedItem = {
  /** 取得元での ID。返さない取得元は null にし、URL で同じ項目かを判定する（FR-008） */
  externalId: string | null;
  url: string;
  title: string;
  /** 公開日時（`toISOString()` の形）。返さない取得元は null */
  publishedAt: string | null;
  imageUrl: string | null;
};

/**
 * 1 回の取得の結果。失敗は投げずに返す（docs/SOFTWARE_DESIGN.md の「失敗の表し方」）。
 * `isComplete` は、取り直した一覧が取得元のすべての項目を含むか（research.md の R7）。
 * `skipped` は、題・URL・公開日が読めずに保存しない項目の数
 */
export type FetchOutcome =
  | { ok: true; items: FetchedItem[]; isComplete: boolean; skipped: number }
  | { ok: false; reason: string };

/**
 * URL を取り直したときの応答の読み方（research.md の R7）。404・410 は `gone`、2xx・3xx は
 * `present`、ほかの状態・通信の失敗・待ち時間切れは判定できない `unknown`
 */
export type UrlCheck = 'gone' | 'present' | 'unknown';

/** 状態コードを `UrlCheck` に読む */
export const toUrlCheck = (status: number): UrlCheck => {
  if (status === 404 || status === 410) return 'gone';
  return status >= 200 && status < 400 ? 'present' : 'unknown';
};

/** 1 回の取得で保存する項目の上限（research.md の R6） */
export const MAX_ITEMS_PER_FETCH = 100;

/** 日時として読める値を `toISOString()` の形にする。読めなければ null */
export const toIsoDateTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

/**
 * 取得元ごとの関数が作った候補を確かめ、保存できる項目と保存しない数に分ける。題が空・URL が
 * http(s) でない・公開日が読めない項目は保存しない（FR-011）。多すぎる分は先頭から上限まで
 */
export const acceptItems = (
  candidates: {
    externalId: string | null;
    url: string | null | undefined;
    title: string | null | undefined;
    publishedAt: string | null | undefined;
    imageUrl: string | null | undefined;
  }[],
): { items: FetchedItem[]; skipped: number } => {
  const items: FetchedItem[] = [];
  let skipped = 0;
  for (const candidate of candidates) {
    const title = candidate.title?.trim() ?? '';
    const url = candidate.url?.trim() ?? '';
    const publishedAt = toIsoDateTime(candidate.publishedAt);
    if (title === '' || !isWebUrl(url) || publishedAt === null) {
      skipped += 1;
      continue;
    }
    const imageUrl = candidate.imageUrl?.trim();
    items.push({
      externalId: candidate.externalId,
      url,
      title,
      publishedAt,
      imageUrl: imageUrl && isWebUrl(imageUrl) ? imageUrl : null,
    });
  }
  return { items: items.slice(0, MAX_ITEMS_PER_FETCH), skipped };
};

/**
 * URL を指名する取得元から 1 件を取った結果（research.md の R9）。取れなければ理由と、取得元で
 * 消えたか（404・410）を返す
 */
export type RegisteredFetchOutcome =
  | { ok: true; title: string; imageUrl: string | null }
  | { ok: false; reason: string; gone: boolean };
