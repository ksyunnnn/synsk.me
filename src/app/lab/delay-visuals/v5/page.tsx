// 自分の画像に delay-visuals の表現をかけ、Instagram のストーリーに載せる動画に書き出す
// /delay-visuals からも、next.config.js の rewrites でこのページを返す
import type { Metadata } from 'next';
import Link from 'next/link';

import { DelayExporter } from './DelayExporter';

export const metadata: Metadata = {
  title: 'delay-visuals を動画に書き出す | synsk.me',
};

// 細かいざらつきを重ねる。色は持たず、下の地の色を暗くするだけ
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const Page = () => (
  <div className="relative min-h-svh bg-linear-165 from-muted to-border">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-15 mix-blend-multiply"
      style={{ backgroundImage: NOISE }}
    />
    <main className="relative mx-auto grid max-w-[640px] gap-12 px-6 pt-12 pb-24">
      <div className="grid gap-2">
        <Link
          href="/lab/delay-visuals"
          className="w-fit text-xs tracking-wider text-muted-foreground underline underline-offset-4"
        >
          delay-visuals
        </Link>
        <h1 className="text-xl">動画に書き出す</h1>
        <p className="text-sm text-muted-foreground">
          自分の画像を、右から左へ、または上から下へ出す動画にする。帯ごとに少しずれた絵が、出し終えるまでに揃う。書き出しは、この端末の中だけで行う。
        </p>
      </div>
      <DelayExporter />
    </main>
  </div>
);

export default Page;
