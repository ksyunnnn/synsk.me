import type { ReactNode } from 'react';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

/**
 * 管理画面のすべての画面に共通の枠。上にサイトのトップへのリンクを置く。何も読まないので、
 * オーナーでない要求にも出してよい（オーナーの確認は各ページと `src/proxy.ts` が持つ）
 */
const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <nav aria-label="サイト" className="mx-auto max-w-2xl px-4 pt-6">
      <TextLink href={routes.top}>サイトのトップへ</TextLink>
    </nav>
    {children}
  </>
);

export default Layout;
