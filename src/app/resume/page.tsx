import { MockPage, mockMetadata } from '@/app/top-draft/MockPage';

export const metadata = mockMetadata('職務経歴書');

const Page = async () => {
  'use cache';
  return <MockPage title="職務経歴書" />;
};

export default Page;
