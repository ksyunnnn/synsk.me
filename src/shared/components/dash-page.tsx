import type { ComponentProps, ReactNode } from 'react';
import { TextLink } from '@/shared/components/text-link';

/**
 * 管理画面の 1 つの画面の枠。`main` の幅と余白、戻るリンク、見出しを、この順に置く。
 * 使い手は管理画面の各ページ。
 *
 * `back` を渡すと、見出しの上に戻るリンクを置く。`title` を渡すと、`h1` を置く
 */
export const DashPage = ({
  back,
  title,
  children,
}: {
  back?: { href: ComponentProps<typeof TextLink>['href']; label: string };
  title?: ReactNode;
  children: ReactNode;
}) => (
  <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
    {back && (
      <p>
        <TextLink href={back.href}>{back.label}</TextLink>
      </p>
    )}
    {title !== undefined && <h1 className="text-2xl font-bold">{title}</h1>}
    {children}
  </main>
);
