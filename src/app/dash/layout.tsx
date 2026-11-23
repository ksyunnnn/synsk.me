import type { ReactNode } from 'react';
import { DashPanes } from '@/shared/components/dash-panes';
import { DashSidebar } from '@/shared/components/dash-sidebar';
import { DraftProvider } from '@/shared/components/drafts';

/**
 * 管理画面のすべての画面に共通の枠。左に Sidebar、右に各画面を置く。狭い画面では Sidebar を上に
 * 置く。何も読まないので、オーナーでない要求にも出してよい（オーナーの確認は各ページと
 * `src/proxy.ts` が持つ）
 */
const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-muted/60">
    {/* 直しかけは管理画面の中を移っても残し、Sidebar にも印を出す（#366 の「直しかけの扱い」） */}
    <DraftProvider>
      <DashPanes sidebar={<DashSidebar />}>{children}</DashPanes>
    </DraftProvider>
  </div>
);

export default Layout;
