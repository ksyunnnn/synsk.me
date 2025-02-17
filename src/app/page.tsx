import Image from 'next/image';
import GlassesIcon from '@/app/asset/glasses.svg';
import Link from 'next/link';
import { Crane } from '@/icon';
import { metadata } from './archives/2024/page';

const LINKEDIN_URL = 'https://www.linkedin.com/in/synsk';

const Page = () => {
  return (
    <main className="pt-16 pb-32 sm:pt-[18vh] sm:pb-[18vh] px-[4vw]">
      <div className="container m-auto">
        <div>
          <div className="py-4">
            <h1 className="text-4xl sm:text-6xl font-bold">
              SYUNSUKE <br className="sm:hidden" />
              KOBASHI
            </h1>
          </div>
          <div className="py-4">
            <h2 className="text-3xl">Full-Stack Web Developer</h2>
          </div>
        </div>

        <div className="max-w-3xl py-20 flex items-center">
          工事中...
          <Crane className="h-8 w-8 animate-bounce mx-2" />
        </div>

        <div className="py-6">
          <Image src={GlassesIcon} width={50} height={50} alt="Picture of the author" />
        </div>

        <div>
          <p>
            <span className="hidden sm:inline">
              Please contact me on{' '}
              <Link
                href={LINKEDIN_URL}
                target="_blank"
                className="underline hover:opacity-80 focus:opacity-80"
              >
                LinkedIn
              </Link>
              .
            </span>
          </p>
          <div className="fixed bottom-0 w-full left-0 p-4 sm:hidden">
            <Link
              href={LINKEDIN_URL}
              target="_blank"
              className="text-sm border p-4 rounded-md flex justify-between bg-white hover:border-black focus:border-black"
            >
              <span>
                Please contact me on <span className="font-bold">LinkedIn</span>
              </span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="py-20">
          <h2 className="text-lg">Website Archives</h2>
          <ul className="py-4">
            <li>
              <span className="mx-2">-</span>
              <Link href="/archives/2024" className="underline">
                {metadata.title?.toString().replace(' | synsk.me', '')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
};

export default Page;
