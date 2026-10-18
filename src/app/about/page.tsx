import { MockPage, mockMetadata } from '@/app/top-draft/MockPage';

export const metadata = mockMetadata('引用による自己紹介');

const Page = async () => {
  'use cache';
  return <MockPage title="引用による自己紹介" note="本人のツイートや記事の引用で作る。" />;
};

export default Page;
