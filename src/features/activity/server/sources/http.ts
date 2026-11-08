import { toUrlCheck, type UrlCheck } from '@/features/activity/domain/fetched-item';

/**
 * 取得元へ要求を出す道具（specs/004-external-activity/research.md の R6）。外への要求はここと
 * 同じディレクトリの関数だけが出す（constitution VIII）。
 *
 * `fetch` は引数で受け取る（docs/SOFTWARE_DESIGN.md の Dependency Injection）。検査は、固定した
 * 応答を返す関数を渡し、外部のサービスを叩かない
 */

export type Http = (url: string, init?: RequestInit) => Promise<Response>;

/** すべての取得元に付ける User-Agent。dev.to は空の User-Agent に 403 を返す（PR #47 の検証記録） */
export const USER_AGENT = 'synsk.me (+https://synsk.me)';
/** 1 つの要求の待ち時間 */
export const REQUEST_TIMEOUT_MS = 10_000;
/** 1 つの応答の大きさの上限（文字数） */
export const MAX_RESPONSE_CHARS = 2_000_000;

export type TextResponse =
  | { ok: true; text: string; headers: Headers }
  | { ok: false; reason: string; status: number | null };

const describeError = (error: unknown) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    ? `${REQUEST_TIMEOUT_MS / 1000} 秒で応答が無い`
    : '通信に失敗した';

/**
 * GET で本文を取る。待ち時間切れ・2xx でない状態・大きさの超過を、投げずに `ok: false` で返す
 * （docs/SOFTWARE_DESIGN.md の「失敗の表し方」）
 */
export const getText = async (
  http: Http,
  url: string,
  headers: Record<string, string> = {},
): Promise<TextResponse> => {
  let response: Response;
  try {
    response = await http(url, {
      headers: { 'user-agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (error) {
    return { ok: false, reason: describeError(error), status: null };
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { ok: false, reason: `状態 ${response.status} を返した`, status: response.status };
  }
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > MAX_RESPONSE_CHARS) {
    await response.body?.cancel();
    return { ok: false, reason: '応答が大きすぎる', status: response.status };
  }
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    return { ok: false, reason: describeError(error), status: null };
  }
  if (text.length > MAX_RESPONSE_CHARS) {
    return { ok: false, reason: '応答が大きすぎる', status: response.status };
  }
  return { ok: true, text, headers: response.headers };
};

/** JSON を読む。読めなければ null */
export const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/**
 * 項目の URL を取り直し、取得元で消えたかを確かめる（research.md の R7）。本文は読まない。
 * 通信の失敗と待ち時間切れは `unknown`
 */
export const checkUrl = async (http: Http, url: string): Promise<UrlCheck> => {
  try {
    const response = await http(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'follow',
    });
    await response.body?.cancel();
    return toUrlCheck(response.status);
  } catch {
    return 'unknown';
  }
};

/** 外の JSON の値を、文字列としてだけ読む。数は文字列にする。ほかは null */
export const stringOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
};

/** 外の JSON の値を、オブジェクトとしてだけ読む */
export const recordOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
