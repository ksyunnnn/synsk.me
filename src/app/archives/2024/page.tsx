import Image from 'next/image';
import GlassesIcon from '@/app/asset/glasses.svg';
import Link from 'next/link';
import { createMetadata } from '@/libs/createMetadata';

export const metadata = createMetadata({
  title: '2024年のデザイン / 2024 Website Design',
});

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

        <div className="max-w-3xl py-6">
          <p>
            I am an experienced full-stack web developer from Japan. I have been mainly focusing on
            UI, Design System, TypeScript, Nextjs, JavaScript and cloud-based development tools
            (like Supabase, Firebase) to develop the products.
          </p>
          <p>I have been working as a web developer in Tokyo since 2016.</p>
          <p>I currently live in Sydney and I am looking for a job making use of my experience.</p>
        </div>

        <div className="py-6">
          <Image src={GlassesIcon} width={50} height={50} alt="Picture of the author" />
        </div>

        <div>
          <p>
            <span className="mr-2 text-6xl font-bold">Hire me!</span>
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
      </div>
    </main>
  );
};

export default Page;
