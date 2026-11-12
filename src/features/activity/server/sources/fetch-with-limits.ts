import 'server-only';

import type { FetchLimits } from '@/features/activity/domain/limits';
import { withTimeout } from '@/shared/server/with-timeout';

/**
 * 取得元への要求に上限をかける（specs/004-external-activity/research.md の R8、contracts/fetch.md）。
 * 取得元ごとの処理は、1 回の取得ごとにこれを 1 つ作り、要求をすべてこれ越しに出す
 */

/** `fetch` と同じ形の関数。単体の検査は作り物の応答を返す関数を渡す */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** 検証記録の再現の手順と同じ値。dev.to は空の User-Agent に 403 を返す */
const USER_AGENT = 'synsk.me (+https://synsk.me)';

/** 取得元が 2xx でない応答を返した。状態の値で、取れない（4xx）と取得元の不調を分けられる */
export class SourceHttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`取得元が HTTP ${status} を返した: ${url}`);
    this.name = 'SourceHttpError';
  }
}

/**
 * その URL の項目が無いことを表す応答（400・401・404・410）。URL を指名する取得元では「取れない」に
 * する。ほかの 4xx（bot の challenge の 403、408、429 など）は取得元の不調として失敗にする
 */
const NOT_FOUND_STATUSES = new Set([400, 401, 404, 410]);

export const isClientError = (error: unknown): boolean =>
  error instanceof SourceHttpError && NOT_FOUND_STATUSES.has(error.status);

type SourceResponse = { status: number; headers: Headers; text: string };

export type SourceHttp = {
  /** まだ出せる要求の数 */
  readonly remaining: number;
  /** 2xx の応答の本文を返す。304 は本文の無い応答として返す。上限を超えたとき・ほかの状態では投げる */
  get: (url: string, headers?: Record<string, string>) => Promise<SourceResponse>;
};

/** 1 回の get で辿るリダイレクトの段の上限 */
const MAX_REDIRECTS = 5;

const isRedirect = (status: number) => [301, 302, 303, 307, 308].includes(status);

export type SourceHttpOptions = {
  /** false なら 3xx を辿らず、2xx でない応答として扱う */
  followRedirects?: boolean;
};

export const createSourceHttp = (
  fetcher: Fetcher,
  limits: FetchLimits,
  { followRedirects = true }: SourceHttpOptions = {},
): SourceHttp => {
  let used = 0;
  return {
    get remaining() {
      return limits.maxRequests - used;
    },
    get: async (url, headers = {}) => {
      if (used >= limits.maxRequests) {
        throw new Error(`要求の数の上限（${limits.maxRequests} 本）に達した`);
      }
      used += 1;
      return withTimeout(
        limits.timeoutMs,
        async (signal) => {
          // リダイレクトは 1 段ずつ辿り、別のホストへは要求を出さない。要求を出すのは、その取得元の
          // ホストだけ（research.md の R10）。fetch に辿らせると、取得元の API キーなどのヘッダが
          // 移った先のホストへ届く
          const origin = new URL(url).host;
          let current = url;
          let response: Response;
          for (let hop = 0; ; hop += 1) {
            response = await fetcher(current, {
              headers: { ...headers, 'User-Agent': USER_AGENT },
              redirect: 'manual',
              signal,
            });
            const location = response.headers.get('Location');
            if (!followRedirects || !isRedirect(response.status) || location === null) break;
            await response.body?.cancel();
            const next = new URL(location, current);
            if (next.host !== origin) throw new Error(`取得元が別のホストへ移した: ${url}`);
            if (hop >= MAX_REDIRECTS) {
              throw new Error(`リダイレクトの段の上限（${MAX_REDIRECTS} 段）を超えた: ${url}`);
            }
            current = next.href;
          }
          // fetcher が redirect: 'manual' を守らずに辿った場合も、別のホストの応答は読まない
          if (response.redirected && new URL(response.url).host !== origin) {
            await response.body?.cancel();
            throw new Error(`取得元が別のホストへ移した: ${url}`);
          }
          // 条件付きの要求に、変わっていないと答えた。本文を持たない（research.md の R9）。条件を
          // 付けていない要求への 304（途中のキャッシュなど）は、中身を取れなかった失敗にする
          const conditional = Object.keys(headers).some((name) =>
            /^if-(none-match|modified-since)$/i.test(name),
          );
          if (response.status === 304 && conditional) {
            await response.body?.cancel();
            return { status: 304, headers: response.headers, text: '' };
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new SourceHttpError(response.status, url);
          }
          const text = await readText(response, limits.maxBytes);
          return { status: response.status, headers: response.headers, text };
        },
        () => new Error(`待ち時間（${limits.timeoutMs} ms）を超えた`),
      );
    },
  };
};

/** 本文を読む。大きさの上限を超えたら、読むのを止めて投げる */
const readText = async (response: Response, maxBytes: number): Promise<string> => {
  const tooLarge = () => new Error(`応答の大きさが上限（${maxBytes} バイト）を超えた`);
  const declared = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};
