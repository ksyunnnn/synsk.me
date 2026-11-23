/** URL の検索の値。同じ名前が複数あるときは最初の値を読む */
export const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * 保存のフォームが、送った時点の一覧の検索の値（`?view=timeline` など）を入れる項目。保存の後に
 * 移る一覧が、この値から見せ方を引き継ぐ
 */
export const RETURN_QUERY_FIELD = 'returnQuery';
