// デザインの実験の一覧。実験の足し方は _lab/registry.ts の注釈にある
import type { Metadata } from 'next';
import Link from 'next/link';

import { getExperiments } from './_lab/registry';
import { routes } from '@/shared/routes';

export const metadata: Metadata = {
  title: 'lab | synsk.me',
};

const Page = () => {
  const experiments = getExperiments();
  return (
    <main className="mx-auto grid min-h-screen max-w-[480px] content-center place-items-center gap-8 px-6 py-16">
      {experiments.length === 0 ? (
        <p className="text-sm text-muted-foreground">実験はまだない</p>
      ) : (
        <ul className="grid gap-4">
          {experiments.map(({ name, versions }) => (
            <li
              key={name}
              className="flex items-baseline justify-between gap-4 border-b border-border pb-4 last:border-b-0"
            >
              <Link
                href={routes.labPage(name)}
                className="font-semibold underline underline-offset-4"
              >
                {name}
              </Link>
              <span className="text-sm text-muted-foreground tabular-nums">
                {versions.length} 版
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
