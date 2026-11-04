// v4 の表現を、文字の多い記事ページにかける
import Link from 'next/link';

import { ScrollDelayPage } from '../ScrollDelayPage';
import { Article } from './Article';

const Page = () => (
  <>
    <div className="mx-auto grid max-w-[560px] gap-2 px-6 pt-16 pb-4">
      <Link
        href="/lab/delay-visuals/v4"
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        v4
      </Link>
      <p className="text-sm text-muted-foreground">v4 の表現を記事ページにかけた。本文は作り物。</p>
    </div>
    <ScrollDelayPage base={<Article />} band={<Article />} streak={<Article />} />
  </>
);

export default Page;
