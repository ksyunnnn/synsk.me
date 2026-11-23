import Link from 'next/link';
import type { ReactNode } from 'react';

/** 管理画面の入口（`/dash`）の部品。まとまりと、その中の 1 つの入口 */

export const DashTile = ({ href, label, note }: { href: string; label: string; note?: string }) => (
  <li>
    <Link
      href={href}
      className="flex h-full flex-col gap-1 rounded-2xl bg-muted/60 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <span className="font-medium">{label}</span>
      {note && <span className="text-small text-muted-foreground">{note}</span>}
    </Link>
  </li>
);

export const DashGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-3xl bg-background p-6">
    <h2 className="text-caption text-muted-foreground">{title}</h2>
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
  </section>
);
