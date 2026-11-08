/**
 * note の操作を止めた理由のうち、どの操作にも共通する文言（specs/003-note/contracts/dash.md）。
 * `'use client'` の部品と Server Component の両方が読むため、別のファイルに置く
 */
export const NOTE_COMMON_MESSAGES: Record<string, string> = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  'not-found': 'この note は見つかりませんでした',
  deleted: 'この note は削除されています。戻してから操作してください',
  conflict:
    'この note は、開いた後に別の画面で保存されていました。操作していません。開き直してから操作してください',
};
