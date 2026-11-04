// v3.1 で写したトップの下書きのページ全体に、v2 の表現（上から下へ出す。帯ごとに追いつくずれ）をかける
import Link from 'next/link';

import { MockTop } from '../v3.1/MockTop';
import { DelayPage } from './DelayPage';

const Page = () => (
  <>
    <div className="mx-auto grid max-w-[480px] gap-2 px-6 pt-16 pb-8">
      <Link
        href="/lab/delay-visuals"
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        delay-visuals
      </Link>
      <h1 className="text-lg font-semibold">v3.2 ページ全体</h1>
      <p className="text-sm text-muted-foreground">
        v3.1 で写したトップの下書きのページ全体に、v2
        の表現をかけた。再生とコマの操作は画面の下にある。
      </p>
    </div>
    <DelayPage base={<MockTop />} band={<MockTop />} streak={<MockTop />} />
  </>
);

export default Page;
