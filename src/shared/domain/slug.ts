/**
 * 訪問者向けの URL の識別子（slug）の形と既定値。使い手は 001 の実績（FR-013）と 002 の職務経歴書
 * （FR-002）。003 の note（FR-002）と 004 の life event（FR-035）も同じ形を持つ。重複は各表の
 * UNIQUE が拒む
 */

/** 識別子の形（各表の `slug` の CHECK）。1〜100 文字の英小文字・数字・ハイフン */
export const isSlug = (value: string): boolean => /^[a-z0-9-]{1,100}$/.test(value);

/**
 * 新しい識別子。題などから推測できない uid で、36 文字の英小文字（16 進）・数字・ハイフンのため
 * `isSlug` を満たす
 */
export const newSlug = (): string => crypto.randomUUID();
