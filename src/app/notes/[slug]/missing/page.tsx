import { notFound } from 'next/navigation';

// 公開していない note への要求を、`src/proxy.ts` がここへ rewrite する。何も読まずに
// `notFound()` を呼ぶため、ストリーミングの前に 404 が決まる
const Page = () => {
  notFound();
};

export default Page;
