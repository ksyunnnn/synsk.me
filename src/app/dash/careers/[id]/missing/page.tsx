import { notFound } from 'next/navigation';

// 無い id の要求を、`src/proxy.ts` がここへ rewrite する。何も読まずに `notFound()` を
// 呼ぶため、ストリーミングの前に 404 が決まる
const Page = () => {
  notFound();
};

export default Page;
