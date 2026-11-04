// v3.2 の表現を、スクロールに合わせて動かす
import Link from 'next/link';

import { MockTop } from '../v3.1/MockTop';
import { ScrollDelayPage } from './ScrollDelayPage';

const Page = () => (
  <>
    <div className="mx-auto grid max-w-[480px] gap-2 px-6 pt-16 pb-8">
      <Link
        href="/lab/delay-visuals"
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        delay-visuals
      </Link>
      <h1 className="text-lg font-semibold">v4 スクロールに合わせる</h1>
      <p className="text-sm text-muted-foreground">
        v3.1 で写したトップの下書きに、v3.2
        の表現をスクロールに合わせてかけた。表示の境目は画面の上から 75%
        の高さにあり、スクロールするとページの上を進む。設定は画面の下にある。
      </p>
    </div>
    <ScrollDelayPage base={<MockTop />} band={<MockTop />} streak={<MockTop />} />
  </>
);

export default Page;
