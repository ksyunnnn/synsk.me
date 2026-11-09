/**
 * 入力の改行を `\n` に揃える。ブラウザはフォームの `<textarea>` の改行を `\r\n` で送る。
 * 使い手は 001 の職歴・実績・学歴、002 の写した行、003 の note の入力
 */
export const normalizeNewlines = (value: string): string => value.replace(/\r\n?/g, '\n');
