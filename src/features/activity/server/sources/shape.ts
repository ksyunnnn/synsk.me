import 'server-only';

/**
 * 取得元の応答の形を確かめる道具。取得元ごとの処理が、外部の値を synsk.me の型に詰め替える
 * ときに使う。形が違えば投げ、部分的に読めた項目で保存した値を書き換えない（FR-020）
 */

export const shapeError = (source: string, detail: string) =>
  new Error(`${source} の応答の形が想定と違う: ${detail}`);

/** 日時の文字列を `YYYY-MM-DDTHH:MM:SS.sssZ`（UTC）にする。読めなければ投げる */
export const toIsoDateTime = (source: string, value: string): string => {
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new Error(`${source} の公開日を読めない: ${value}`);
  return new Date(time).toISOString();
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 空でない文字列か */
export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** JSON の本文を読む。読めなければ形の誤りとして投げる */
export const parseJson = (source: string, text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw shapeError(source, 'JSON として読めない');
  }
};
