'use client';
// 同じ画面を 2 つの URL で出す（/delay-visuals は next.config.js の rewrites でこのページを返す）。
// 表の URL（/delay-visuals）では下にサイトのトップへのクレジットを、lab の URL では上に実験の一覧へ戻るリンクを出す。
// rewrites の後も、usePathname はアドレスバーの URL を返す
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const isLab = (pathname: string | null) => pathname?.startsWith('/lab/') ?? false;

// lab のほかの版と同じく、画面の上に実験の名前で一覧へ戻るリンクを置く（v1・v2 の page.tsx と同じ形）
export const LabBackLink = () => {
  if (!isLab(usePathname())) return null;
  return (
    <Link
      href="/lab/delay-visuals"
      className={`w-fit text-sm text-muted-foreground underline underline-offset-4 ${focusRing}`}
    >
      delay-visuals
    </Link>
  );
};

// 作った人のクレジット。画面のいちばん下に、目立たせずに置く。外部へのリンクは、職務経歴書の外部リンク
// （src/features/resume/components/visitor-resume.tsx）と同じく、同じタブで開き rel="noopener noreferrer" を付ける
const TWITTER_URL = 'http://twitter.com/ksyunnnn';

export const Credit = () => {
  if (isLab(usePathname())) return null;
  return (
    <footer className="pt-24 pb-[max(2rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
      つくった人{' '}
      <a
        href={TWITTER_URL}
        rel="noopener noreferrer"
        className={`underline underline-offset-4 ${focusRing}`}
      >
        @ksyunnnn
      </a>
    </footer>
  );
};
