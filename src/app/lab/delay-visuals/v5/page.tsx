// delay-visuals: 自分の写真に表現をかけ、Instagram のストーリーに載せる動画に書き出すアプリ
// /delay-visuals からも、next.config.js の rewrites でこのページを返す
import type { Metadata } from 'next';

import { DelayExporter } from './DelayExporter';

export const metadata: Metadata = {
  title: 'delay visuals',
};

// 灰色の傾きとざらつきは layout.tsx が html に敷く。ステータスバーとツールバーの後ろまで同じ地にするため
// サイトの html は lang="en" なので、このアプリの範囲を日本語と示す
const Page = () => (
  <div lang="ja" className="min-h-dvh">
    <main className="mx-auto max-w-[640px] pr-[max(1.5rem,env(safe-area-inset-right))] pl-[max(1.5rem,env(safe-area-inset-left))]">
      <DelayExporter />
    </main>
  </div>
);

export default Page;
