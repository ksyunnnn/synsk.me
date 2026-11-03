import Link from 'next/link';

import { getVersions } from './registry';

export const VersionList = ({ name }: { name: string }) => (
  <main className="mx-auto grid min-h-screen max-w-[480px] content-center gap-8 px-6 py-16">
    <div className="grid gap-1">
      <Link
        href="/lab"
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        lab
      </Link>
      <h1 className="text-lg font-semibold">{name}</h1>
    </div>
    <ul className="grid gap-4">
      {getVersions(name).map(({ version, href, summary }) => (
        <li key={version} className="grid gap-1 border-b border-border pb-4 last:border-b-0">
          <Link href={href} className="w-fit font-semibold underline underline-offset-4">
            {version}
          </Link>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </li>
      ))}
    </ul>
  </main>
);
