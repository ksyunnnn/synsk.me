/** URL の検索の値。同じ名前が複数あるときは最初の値を読む */
export const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * 保存のフォームが、送った時点の一覧の検索の値（`?view=timeline` など）を入れる項目。保存の後に
 * 移る一覧が、この値から見せ方を引き継ぐ
 */
export const RETURN_QUERY_FIELD = 'returnQuery';

/**
 * 送られた検索の値から、`keys` に挙げた名前だけを、最初の値で残す。フォームから届く値は書き換え
 * られうるため、知らせの印（`saved` など）や知らない名前を持ち越さない。経路は呼び手が決め、ここ
 * では検索の値だけを作る
 */
export const keepParams = (search: string, keys: readonly string[]) => {
  const source = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value) kept.set(key, value);
  }
  return kept;
};
