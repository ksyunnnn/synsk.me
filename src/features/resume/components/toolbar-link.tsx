import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 職務経歴書の上の帯に置く操作の見た目。HIG の Toolbars（枠を付けない）と Buttons（押せる範囲は
 * 44×44 以上）に従い、文字は添え書きと同じ灰色の 14px・細字 300 にする
 */
export const TOOLBAR_ACTION =
  'inline-flex min-h-11 items-center gap-2 text-[14px] leading-[24px] font-light text-[#686868] hover:text-[#242424] rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:hidden';

/** 上の帯の左端に置く、前のページへ戻るリンク。左向きの矢印を添える（HIG の Toolbars の Navigation） */
export const ToolbarBackLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className={TOOLBAR_ACTION}>
    {/* 矢印の線は枠の左から 6px 内側で始まるので、その分を左へ出して線を中身の端にそろえる */}
    <svg
      aria-hidden="true"
      className="-ml-1.5"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
    {children}
  </Link>
);
