import type { ComponentProps, ReactNode } from 'react';
import { TextLink } from '@/shared/components/text-link';

/**
 * 管理画面の 1 つの画面の枠。`main` の幅と余白、戻るリンク、見出しを、この順に置く。
 * 使い手は管理画面の各ページ。
 *
 * `back` を渡すと、見出しの上に戻るリンクを置く。`title` を渡すと、`headingLevel` の段の見出し
 * （既定は `h1`）を置く。ほかの画面の中の区画（職務経歴書の中身など）では 2 にする
 */
export const DashPage = ({
  back,
  title,
  headingLevel = 1,
  children,
}: {
  back?: { href: ComponentProps<typeof TextLink>['href']; label: string };
  title?: ReactNode;
  headingLevel?: 1 | 2;
  children: ReactNode;
}) => (
  <main className="flex flex-col gap-6 rounded-3xl bg-background px-6 py-12 md:px-12">
    {back && (
      <p>
        <TextLink href={back.href}>{back.label}</TextLink>
      </p>
    )}
    {title !== undefined &&
      (headingLevel === 1 ? (
        <h1 className="text-2xl font-bold">{title}</h1>
      ) : (
        <h2 className="text-2xl font-bold">{title}</h2>
      ))}
    {children}
  </main>
);
