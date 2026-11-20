'use client';

import { Menu } from '@base-ui/react/menu';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * 1 つの軸で絞る Pop-up button（HIG Pop-up buttons: 排他の選択肢の平らな並び）。選ぶと、その条件の
 * 一覧へ移る。操作とキーボードは Base UI の Menu が持つ
 */
export const FilterMenu = ({
  label,
  options,
}: {
  /** 軸の名前。例: 組織 */
  label: string;
  /** 先頭は「すべて」。`current` は 1 つだけ */
  options: { label: string; href: string; current: boolean }[];
}) => {
  const current = options.find((option) => option.current);
  const active = current !== undefined && current !== options[0];
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 text-small focus-visible:outline-2 focus-visible:outline-ring',
          active ? 'bg-tint/12 font-medium text-tint' : 'bg-foreground/6 text-muted-foreground',
        )}
      >
        {label}
        {active && `: ${current.label}`}
        <span aria-hidden>▾</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-50">
          <Menu.Popup className="glass max-h-[60dvh] min-w-44 overflow-y-auto rounded-2xl p-1.5 text-small outline-none">
            {options.map((option) => (
              <Menu.LinkItem
                key={option.label}
                closeOnClick
                render={<Link href={option.href} scroll={false} />}
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 outline-none data-[highlighted]:bg-tint data-[highlighted]:text-tint-foreground"
              >
                <span aria-hidden className="w-3">
                  {option.current ? '✓' : ''}
                </span>
                {option.label}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};
