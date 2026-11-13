// トップ。Figma の「小橋俊介 study」（ファイル yhHrXDTtvF7CjkLCeOZOU8、ノード 7:9）を書いたもの。
// Figma の長さは design/foundations.pen の半分の縮尺で描かれているため、2 倍してトークンに合わせる。
// 線の間には一覧（specs/005-feed）の最新の activity の題を並べる。データの取り方は top-draft と同じ
import { ActivityLinks } from '@/features/activity/components/activity-links';
import { listFeedItems } from '@/features/activity/server/queries';
import { notoSerifJp, tinos } from '@/lib/fonts';
import { PaperFiber } from '@/shared/components/paper-fiber';
import { SnsLinks } from '@/shared/components/sns-links';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す。D1 から読めない
// ときに 500 を返すため、`loading.tsx` を置かない。キャッシュしない（specs/005-feed/research.md の R9）
export const instant = false;

/**
 * 内容の幅 1240px（Figma の 620px の 2 倍）のときの長さを、内容の幅に比例して縮める。
 * 内容の幅が 1240px 以上のときは、そのままの長さにする。負の長さは、絶対値を縮めてから符号を付ける
 */
const scaled = (px: number): string =>
  px < 0 ? `calc(-1 * ${scaled(-px)})` : `min(${px}px, ${px / 12.4}cqw)`;

const Page = async () => {
  const { items } = await listFeedItems(1);
  return (
    <div className={`${notoSerifJp.className} min-h-screen bg-background text-foreground`}>
      <main className="mx-auto max-w-[calc(1240px+2*var(--spacing-space-lg))] px-space-lg pt-[14px] pb-space-xl">
        <div className="@container">
          <header className="flex items-start justify-between gap-space-sm">
            <div className="min-w-0 tracking-heading whitespace-nowrap">
              <h1
                className={tinos.className}
                style={{ fontSize: scaled(128), lineHeight: scaled(120) }}
              >
                SHUNSUKE
                <br />
                KOHASHI
              </h1>
              <p style={{ fontSize: scaled(112), lineHeight: scaled(140), marginTop: scaled(-12) }}>
                小橋俊介
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-2" style={{ gap: scaled(36) }}>
              {[1, 2, 3, 4].map((key) => (
                <PaperFiber key={key} style={{ width: scaled(136), height: scaled(136) }} />
              ))}
            </div>
          </header>

          <hr className="border-0 border-t border-foreground" />

          <section aria-label="activity" className="py-space-sm text-body">
            <ActivityLinks items={items} />
          </section>

          <hr className="border-0 border-t border-foreground" />

          <div className="mt-space-md flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
            {/* 縮めた高さに文字が収まらない幅では、文字の分だけ伸ばす */}
            <div className="flex gap-space-sm" style={{ minHeight: scaled(406) }}>
              <PaperFiber className="shrink-0" style={{ width: scaled(56) }} />
              <PaperFiber className="shrink-0" style={{ width: scaled(80) }} />
              <PaperFiber className="shrink-0" style={{ width: scaled(16) }} />
              <div className="flex min-w-0 flex-1 md:flex-none">
                <div className="min-w-0 flex-1 pt-space-xs md:w-[228px] md:flex-none">
                  <p className="text-heading-1">連絡はDMへ。</p>
                  <p className="text-body">
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
                <PaperFiber className="shrink-0" style={{ width: scaled(4) }} />
              </div>
            </div>
            <SnsLinks className="self-end" iconSize={scaled(136)} gap={scaled(36)} />
          </div>

          <PaperFiber className="mt-space-sm w-full" style={{ height: scaled(60) }} />
        </div>
      </main>
    </div>
  );
};

export default Page;
