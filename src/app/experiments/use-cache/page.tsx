'use cache';

// #105 の実験用の経路。`'use cache'` で書いたページが、エッジのキャッシュに
// 載るかを確かめるために置く。マージしない。
//
// `export const revalidate` を持たない。`'use cache'` と `cacheLife()` だけで
// キャッシュの方針を与えたときの判定を見るため。

import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';

export const generateMetadata = async (): Promise<Metadata> => {
  cacheLife('hours');
  return {
    title: "'use cache' の実験 | synsk.me",
    robots: { index: false, follow: false },
  };
};

const Page = async () => {
  cacheLife('hours');
  // 描画した時刻。2 回の取得で同じ値が返れば、描画の結果が使い回されている
  const renderedAt = new Date().toISOString();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">&apos;use cache&apos; の実験（#105）</h1>
      <p>
        描画した時刻: <time data-testid="rendered-at">{renderedAt}</time>
      </p>
    </main>
  );
};

export default Page;
