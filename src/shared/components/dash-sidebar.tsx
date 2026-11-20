'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { routes } from '@/shared/routes';

/**
 * 管理画面の Sidebar。オブジェクトを 3 つのまとまり（職務経歴書・経歴・サイトの発信）に分けて並べる。
 * 階層は 2 段まで（HIG Sidebars）。開いている経路を強調し続ける（HIG Split views）
 */
const GROUPS = [
  {
    label: '職務経歴書',
    items: [{ href: routes.dash.resumes.list, label: '職務経歴書' }],
  },
  {
    label: '経歴',
    items: [
      { href: routes.dash.projects.list, label: '実績' },
      { href: routes.dash.careers.list, label: '職歴' },
      { href: routes.dash.organizations.list, label: '組織' },
      { href: routes.dash.educations.list, label: '学歴' },
      { href: routes.dash.skills.list, label: 'スキル' },
    ],
  },
  {
    label: 'サイトの発信',
    items: [
      { href: routes.dash.notes.list, label: 'note' },
      { href: routes.dash.lifeEvents.list, label: 'life event' },
      { href: routes.dash.activities.list, label: '外部の activity' },
    ],
  },
] as const;

export const DashSidebar = () => {
  const pathname = usePathname();
  return (
    <nav
      aria-label="管理する項目"
      className="glass flex gap-1 overflow-x-auto rounded-3xl p-2 text-small md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)] md:flex-col md:gap-6 md:overflow-y-auto md:p-3"
    >
      <Link
        href={routes.dash.index}
        className="shrink-0 rounded-xl px-3 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-ring md:py-2"
      >
        管理画面
      </Link>
      {GROUPS.map((group) => (
        <div key={group.label} className="flex shrink-0 flex-col gap-1">
          {/* 狭い画面では、まとまりの名前を省いて横に並べる */}
          <p className="hidden px-3 text-caption font-medium text-muted-foreground md:block">
            {group.label}
          </p>
          <ul className="flex md:flex-col">
            {group.items.map(({ href, label }) => {
              const current = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'block rounded-xl px-3 py-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
                      current ? 'bg-foreground/8 font-medium' : 'hover:bg-foreground/5',
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Link
        href={routes.top}
        className="hidden rounded-xl px-3 py-2 text-muted-foreground md:mt-auto md:block hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
      >
        サイトのトップへ
      </Link>
    </nav>
  );
};
