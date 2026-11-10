// delay-visuals: 自分の写真に表現をかけ、Instagram のストーリーに載せる動画に書き出すアプリ
// /delay-visuals からも、next.config.js の rewrites でこのページを返す
import type { Metadata } from 'next';

import { DelayExporter } from './DelayExporter';

export const metadata: Metadata = {
  title: 'delay visuals',
};

// 細かいざらつきを重ねる。色は持たず、下の地の色を暗くするだけ
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// サイトの html は lang="en" なので、このアプリの範囲を日本語と示す
const Page = () => (
  <div lang="ja" className="relative min-h-svh bg-linear-165 from-muted to-border">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-15 mix-blend-multiply"
      style={{ backgroundImage: NOISE }}
    />
    <main className="relative mx-auto max-w-[640px] px-6">
      <DelayExporter />
    </main>
  </div>
);

export default Page;
