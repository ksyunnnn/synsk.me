import type { ReactNode } from 'react';
import { DashSidebar } from '@/shared/components/dash-sidebar';
import { DraftProvider } from '@/shared/components/drafts';

/**
 * 管理画面のすべての画面に共通の枠。左に Sidebar、右に各画面を置く。狭い画面では Sidebar を上に
 * 置く。何も読まないので、オーナーでない要求にも出してよい（オーナーの確認は各ページと
 * `src/proxy.ts` が持つ）
 */
const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-muted/60">
    <div className="mx-auto grid max-w-[1440px] gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <DashSidebar />
      {/* 直しかけは管理画面の中を移っても残す（#366 の「直しかけの扱い」） */}
      <DraftProvider>
        <div className="min-w-0">{children}</div>
      </DraftProvider>
    </div>
  </div>
);

export default Layout;
