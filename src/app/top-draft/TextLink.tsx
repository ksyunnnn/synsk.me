import Link from 'next/link';

export const TextLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="w-fit font-normal underline underline-offset-4">
    {children}
  </Link>
);
