'use client';

import { useSearchParams } from 'next/navigation';
import { RETURN_QUERY_FIELD } from '@/shared/domain/search-param';

/**
 * 送った時点の一覧の検索の値を、保存のフォームと一緒に送る。保存の後に移る一覧が、見せ方
 * （`?view=timeline` など）を引き継ぐ。受け取る側は `routes` の `selected` が名前を選んで残す
 */
export const ReturnQueryField = () => {
  const searchParams = useSearchParams();
  return <input type="hidden" name={RETURN_QUERY_FIELD} value={searchParams.toString()} />;
};
