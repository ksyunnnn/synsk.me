// v4 の表現で、表示の境目の高さをスクロールに合わせて変える
import Link from 'next/link';

import { MockTop } from '../v3.1/MockTop';
import { ScrollDelayPage } from './ScrollDelayPage';

const ARTICLE = '/lab/delay-visuals/v4.2/rebuild';

const Page = () => (
  <>
    <div className="mx-auto grid max-w-[480px] gap-2 px-6 pt-16 pb-8">
      <Link
        href="/lab/delay-visuals"
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        delay-visuals
      </Link>
      <h1 className="text-lg font-semibold">v4.2 境目の高さが動く</h1>
      <p className="text-sm text-muted-foreground">
        v4 と同じトップの下書きにかけた。表示の境目は最初は画面の上から 30% にあり、1
        画面ぶんスクロールするあいだに 64% へ動く。設定は画面の下にある。
      </p>
    </div>
    <ScrollDelayPage
      base={<MockTop articleHref={ARTICLE} />}
      band={<MockTop articleHref={ARTICLE} />}
      streak={<MockTop articleHref={ARTICLE} />}
    />
  </>
);

export default Page;
