'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { routes } from '@/shared/routes';

/**
 * 職務経歴書の中身を切り替える Tab view（HIG Tab views: 近い関係の中身の区画を切り替える。6 つまで）。
 * 区画は経路で持ち、開いている区画を `aria-current` で示す（#366 の明文化）
 */
export const ResumeTabs = ({ uid }: { uid: string }) => {
  const pathname = usePathname();
  const r = routes.dash.resumes;
  const tabs = [
    { href: r.entries(uid, 'projects'), label: '写した実績' },
    { href: r.entries(uid, 'careers'), label: '写した職歴' },
    { href: r.entries(uid, 'educations'), label: '写した学歴' },
    { href: r.skills(uid), label: 'スキル' },
    { href: r.preview(uid), label: 'プレビュー' },
    { href: r.row(uid), label: '設定' },
  ];
  return (
    <nav aria-label="職務経歴書の中身" className="-mx-1 overflow-x-auto">
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const current =
            tab.href === r.row(uid) ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'block rounded-full px-3 py-1.5 text-small whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring',
                  current
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:bg-foreground/5',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
