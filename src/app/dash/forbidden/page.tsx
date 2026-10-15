import { forbidden } from 'next/navigation';

// 作り手でない要求を、`src/proxy.ts` がここへ rewrite する。何も読まずに `forbidden()` を
// 呼ぶため、ストリーミングの前に 403 が決まる
const Page = () => {
  forbidden();
};

export default Page;
