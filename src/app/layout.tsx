import './globals.css';
import type { Metadata } from 'next';
import { Lato } from 'next/font/google';

const lato = Lato({ subsets: ['latin'], weight: ['100', '300', '400', '700'] });

export const metadata: Metadata = {
  title: 'synsk.me',
  description: 'SYUNSUKE KOBASHI / 小橋俊介 / こばしゅん',
  keywords: [
    'portfolio',
    'synsk',
    'ksyunnnn',
    '小橋俊介',
    'こばしゅん',
    'SYUNSUKE KOBASHI',
    'Nextjs',
    'React',
    'TypeScript',
  ],
  openGraph: {
    type: 'website',
    title: 'synsk.me',
    description: 'SYUNSUKE KOBASHI / 小橋俊介 / こばしゅん',
  },
  twitter: {
    card: 'summary',
    title: 'synsk.me',
    description: 'SYUNSUKE KOBASHI / 小橋俊介 / こばしゅん',
    creator: '@ksyunnnn',
  },
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body className={lato.className}>{children}</body>
    </html>
  );
};

export default Layout;
