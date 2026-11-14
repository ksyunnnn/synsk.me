// トップ。Figma の「小橋俊介 study」（ファイル yhHrXDTtvF7CjkLCeOZOU8、ノード 7:9）の文字の大きさ・行の高さ・
// 字間・幅をそのまま書いたもの。余白は Figma の space/8・16・24 を foundations の space-xs・sm・md で使う。
// 線の間には一覧（specs/005-feed）の最新の activity の題を並べる。データの取り方は top-draft と同じ
import type { Viewport } from 'next';
import { ActivityLinks } from '@/features/activity/components/activity-links';
import { listFeedItems } from '@/features/activity/server/queries';
import { notoSerifJp, sourceSans, tinos } from '@/lib/fonts';
import { PaperCanvas, paperCanvasViewport } from '@/shared/components/paper-canvas';
import { PaperFiber } from '@/shared/components/paper-fiber';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す。D1 から読めない
// ときに 500 を返すため、`loading.tsx` を置かない。キャッシュしない（specs/005-feed/research.md の R9）
export const instant = false;

export const viewport: Viewport = paperCanvasViewport;

const SOCIAL_LINKS = [
  { label: 'X', href: 'https://twitter.com/ksyunnnn' },
  { label: 'Facebook', href: 'https://www.facebook.com/syunsuke.kobashi' },
  { label: 'Zenn', href: 'https://zenn.dev/ksyunnnn' },
  { label: 'GitHub', href: 'https://github.com/ksyunnnn' },
  { label: 'Qiita', href: 'https://qiita.com/ksyunnnn' },
  { label: 'DEV', href: 'https://dev.to/ksyunnnn' },
  { label: 'Medium', href: 'https://medium.com/@ksyunnnn' },
  { label: 'Speaker Deck', href: 'https://speakerdeck.com/ksyunnnn' },
  { label: 'Spotify', href: 'https://open.spotify.com/user/21xqcp2fwj4histejz5mtqlsi' },
  { label: 'CodeSandbox', href: 'https://codesandbox.io/u/ksyunnnn' },
  { label: 'YouTube', href: 'https://www.youtube.com/@synsk_hello' },
  { label: 'CodePen', href: 'https://codepen.io/ksyunnnn' },
];

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;

const Page = async () => {
  const { items } = await listFeedItems(1);
  return (
    <>
      <PaperCanvas />
      <main
        className={`${notoSerifJp.className} @container mx-auto flex max-w-[calc(800px+2*var(--spacing-space-md))] flex-col gap-space-sm py-space-md pr-[max(var(--spacing-space-md),env(safe-area-inset-right))] pl-[max(var(--spacing-space-md),env(safe-area-inset-left))] text-foreground`}
      >
        {/* 名前と「制作記録」が横に入りきらない幅（内容の幅 500px 未満）では、「制作記録」を名前の下に置く */}
        <header className="flex flex-col @min-[500px]:h-[184px] @min-[500px]:flex-row @min-[500px]:justify-between">
          <div>
            <h1
              className={`${tinos.className} -mt-[8px] text-[66px] leading-[59px] tracking-[-1.98px]`}
            >
              SHUNSUKE
              <br />
              KOBASHI
            </h1>
            <p className="mt-[2px] text-[56px] leading-[66px] tracking-[-2.8px]">小橋俊介</p>
          </div>
          <p className="mr-[8px] flex gap-[10px] self-end text-[72px] leading-[80px] @min-[500px]:-mt-[7px] @min-[500px]:self-start">
            <span className="flex flex-col">
              <span>制</span>
              <span>作</span>
            </span>
            <span className="flex flex-col">
              <span>記</span>
              <span>録</span>
            </span>
          </p>
        </header>

        <hr className="h-px shrink-0 border-0 bg-foreground" />

        <section aria-label="activity" className="text-[14px] leading-[22px]">
          <ActivityLinks items={items} />
        </section>

        <hr className="h-px shrink-0 border-0 bg-foreground" />

        <div className="@container">
          {/* 3 列が入りきらない幅（内容の幅 588px 未満）では、Figma の順に縦に積む */}
          <div className="flex flex-col gap-space-sm @min-[588px]:h-[208px] @min-[588px]:flex-row">
            <div className="flex h-[208px] w-[122px] shrink-0 gap-space-xs">
              <PaperFiber className="w-[12px] shrink-0" />
              <p className="whitespace-nowrap">
                <span className="block text-[29px] leading-[36px]">連絡は</span>
                <span className="block text-[27px] leading-[36px]">DMへ。</span>
              </p>
            </div>
            <div
              aria-hidden
              className="h-px w-full shrink-0 bg-foreground @min-[588px]:h-auto @min-[588px]:w-px"
            />
            <a
              href="https://2024.synsk.me"
              {...EXTERNAL}
              className="flex h-[208px] w-[191px] shrink-0 flex-col justify-between whitespace-nowrap"
            >
              <span className="text-[21px] leading-[29px]">年のデザイン</span>
              <span className={`${tinos.className} text-[22px] leading-[23px]`}>
                DESIGN
                <br />
                ARCHIVE
              </span>
              <span className={`${tinos.className} text-[77px] leading-[82px] tracking-[-4.62px]`}>
                2024
              </span>
            </a>
            <div
              aria-hidden
              className="h-px w-full shrink-0 bg-foreground @min-[588px]:h-auto @min-[588px]:w-px"
            />
            {/* 縦書き（vertical-rl）。列は右から左へ並び、ラテン文字は右に 90° 回る */}
            <nav aria-label="SNS" className="flex min-w-0 flex-1 justify-end">
              {/* 縦書きの中では flex-col が右から左（block の向き）に並べる */}
              <div className="flex h-[208px] flex-col [writing-mode:vertical-rl]">
                <p className={`${sourceSans.className} text-[16px] leading-[20px] font-light`}>
                  SOCIAL / LINKS
                </p>
                <ul className="flex flex-col">
                  {SOCIAL_LINKS.map(({ label, href }) => (
                    <li key={label} className="border-l border-foreground">
                      <a
                        href={href}
                        {...EXTERNAL}
                        className="flex h-full w-[46px] items-center justify-between whitespace-nowrap"
                      >
                        <span className={`${tinos.className} text-[29px] leading-[36px]`}>
                          {label}
                        </span>
                        <span
                          aria-hidden
                          className={`${sourceSans.className} text-[22px] leading-[30px] font-light`}
                        >
                          ↗
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>
        </div>

        <PaperFiber className="flex h-[196px] flex-col justify-between p-space-sm text-background">
          <div className="relative flex h-[32px] items-start justify-between">
            <p className="text-[22px] leading-[30px]">小橋俊介</p>
            <p className="text-[14px] leading-[24px]">連絡はDMへ。</p>
          </div>
          <p className={`${tinos.className} relative text-[51px] leading-[58px]`}>
            SHUNSUKE KOBASHI
          </p>
        </PaperFiber>
      </main>
    </>
  );
};

export default Page;
