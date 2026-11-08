/**
 * 関連 URL として通す URL か。画面でリンクにするため、http か https の URL だけを通す。
 * 使い手は project と career の入力
 */
export const isWebUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
