import { MockPage, mockMetadata } from '@/app/top-draft/MockPage';

export const metadata = mockMetadata('連絡');

const Page = async () => {
  'use cache';
  return <MockPage title="連絡" note="連絡の入口の手段は未定。" />;
};

export default Page;
