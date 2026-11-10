// v2 の表現を HTML のコンテンツ（トップの下書き）に使えるかを確かめる。まずはページを写しただけ
import Link from 'next/link';

import { MockTop } from './MockTop';
import { routes } from '@/shared/routes';

const Page = () => (
  <>
    <div className="mx-auto grid max-w-[480px] gap-2 px-6 pt-16 pb-8">
      <Link
        href={routes.labPage('delay-visuals')}
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        delay-visuals
      </Link>
      <h1 className="text-lg font-semibold">v3.1 HTML のコンテンツ</h1>
      <p className="text-sm text-muted-foreground">
        v2
        の表現を、トップの下書きのページに使えるかを確かめる。まずは下書きを写しただけで、表現はまだかけていない。埋め込みと、下のほうの節（つながりの可視化から名刺デザインの項目まで）は入れていない。timeline
        は埋め込みを除く新しい 10 件。
      </p>
    </div>
    <MockTop />
  </>
);

export default Page;
