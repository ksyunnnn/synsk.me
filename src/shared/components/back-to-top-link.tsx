import Link from 'next/link';
import { routes } from '@/shared/routes';

/**
 * 訪問者のページから、サイトのトップへ戻るリンク。個別のページと 404 の画面に置く
 * （PRINCIPLES の「たどり着きたい情報 over 演出」、HIG の Toolbars）。行き先は `routes.top`。
 * 見た目は訪問者の一覧（`src/features/activity/components/feed.tsx`）のリンクと同じ。
 * 職務経歴書の PDF は画面の印刷で作るので、印刷には出さない
 */
export const BackToTopLink = () => (
  <p className="print:hidden">
    <Link
      href={routes.top}
      className="w-fit underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      トップへ戻る
    </Link>
  </p>
);
