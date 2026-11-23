/** URL の検索の値。同じ名前が複数あるときは最初の値を読む */
export const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;
