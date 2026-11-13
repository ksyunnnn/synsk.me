// トップ。Figma の「小橋俊介 study」（ファイル yhHrXDTtvF7CjkLCeOZOU8、ノード 7:9）の配置を、
// design/foundations.pen のトークンで書いたもの。線の間には一覧（specs/005-feed）の最新の activity の
// 題を並べる。データの取り方は top-draft と同じ
import { ActivityLinks } from '@/features/activity/components/activity-links';
import { listFeedItems } from '@/features/activity/server/queries';
import { fontFamily, sourceSans } from '@/lib/fonts';
import { PaperFiber } from '@/shared/components/paper-fiber';
import { SnsLinks } from '@/shared/components/sns-links';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す。D1 から読めない
// ときに 500 を返すため、`loading.tsx` を置かない。キャッシュしない（specs/005-feed/research.md の R9）
export const instant = false;

const Page = async () => {
  const { items } = await listFeedItems(1);
  return (
    <div
      className={`${sourceSans.className} min-h-screen bg-background text-foreground`}
      style={{ fontFamily }}
    >
      <main className="mx-auto max-w-(--breakpoint-md) px-space-md pt-space-md pb-space-xl font-light">
        <header className="flex items-start justify-between gap-space-sm">
          <div className="min-w-0 text-heading-1 tracking-heading">
            <h1>
              SHUNSUKE
              <br />
              KOHASHI
            </h1>
            <p>小橋俊介</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-space-xs">
            {[1, 2, 3, 4].map((key) => (
              <PaperFiber key={key} className="size-space-lg" />
            ))}
          </div>
        </header>

        <hr className="mt-space-md border-foreground" />

        <section aria-label="activity" className="py-space-sm text-small">
          <ActivityLinks items={items} />
        </section>

        <hr className="border-foreground" />

        <div className="mt-space-sm flex h-[203px] gap-space-xs">
          <PaperFiber className="w-[28px] shrink-0" />
          <PaperFiber className="w-[40px] shrink-0" />
          <PaperFiber className="w-[8px] shrink-0" />
          <div className="min-w-0 basis-[122px]">
            <p className="text-body">連絡はDMへ。</p>
            <p className="text-small">
              <a
                href="https://2024.synsk.me"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                2024年のデザイン
              </a>
            </p>
          </div>
          <PaperFiber className="w-[2px] shrink-0" />
          <SnsLinks className="ml-auto self-end" />
        </div>

        <PaperFiber className="mt-space-xs h-[30px] w-full" />
      </main>
    </div>
  );
};

export default Page;
