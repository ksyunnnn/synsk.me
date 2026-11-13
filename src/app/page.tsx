// トップ。Figma の「小橋俊介 study」（ファイル yhHrXDTtvF7CjkLCeOZOU8、ノード 7:9）を書いたもの。
// 線の間には一覧（specs/005-feed）の最新の activity の題を並べる。データの取り方は top-draft と同じ
import { ActivityLinks } from '@/features/activity/components/activity-links';
import { listFeedItems } from '@/features/activity/server/queries';
import { notoSerifJp, tinos } from '@/lib/fonts';
import { PaperFiber } from '@/shared/components/paper-fiber';
import { SnsLinks } from '@/shared/components/sns-links';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す。D1 から読めない
// ときに 500 を返すため、`loading.tsx` を置かない。キャッシュしない（specs/005-feed/research.md の R9）
export const instant = false;

const Page = async () => {
  const { items } = await listFeedItems(1);
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#242424]">
      <main
        className={`${notoSerifJp.className} mx-auto max-w-[668px] px-6 pt-[7px] pb-24`}
        style={{ fontFamily: `${notoSerifJp.style.fontFamily}, serif` }}
      >
        <header className="flex h-[190px] justify-between whitespace-nowrap">
          <div>
            <h1
              className={`${tinos.className} text-[64px] leading-[60px] tracking-[-1.28px]`}
              style={{ fontFamily: `${tinos.style.fontFamily}, serif` }}
            >
              SHUNSUKE
              <br />
              KOHASHI
            </h1>
            <p className="mt-[-6px] text-[56px] leading-[70px] tracking-[-2.8px]">小橋俊介</p>
          </div>
          <div className="grid h-[172px] w-[172px] grid-cols-2 gap-[18px] p-2">
            {[1, 2, 3, 4].map((key) => (
              <PaperFiber key={key} className="h-[68px] w-[68px]" />
            ))}
          </div>
        </header>

        <hr className="border-0 border-t-[0.5px] border-[#242424]" />

        <section
          aria-label="activity"
          className="mt-[6px] h-[93px] overflow-hidden pt-[3px] text-[9px] leading-[15px] tracking-[-0.27px]"
        >
          <ActivityLinks items={items} />
        </section>

        <hr className="mt-[9px] border-0 border-t-[0.5px] border-[#242424]" />

        <div className="relative mt-[13px] h-[203px]">
          <PaperFiber className="absolute top-0 left-0 h-full w-[28px]" />
          <PaperFiber className="absolute top-0 left-[36px] h-full w-[40px]" />
          <PaperFiber className="absolute top-0 left-[84px] h-full w-[8px]" />
          <PaperFiber className="absolute top-0 left-[214px] h-full w-[2px]" />
          <div className="absolute top-[5px] left-[100px] whitespace-nowrap">
            <p className="text-[16px]">連絡はDMへ。</p>
            <p className="text-[10px] leading-[24px]">
              <a
                href="https://2024.synsk.me"
                className="text-[color:LinkText] underline underline-offset-2"
              >
                2024年のデザイン
              </a>
            </p>
          </div>
          <SnsLinks className="absolute top-[140px] right-0 h-[68px]" />
        </div>

        <PaperFiber className="mt-[10px] h-[30px] w-full" />
      </main>
    </div>
  );
};

export default Page;
