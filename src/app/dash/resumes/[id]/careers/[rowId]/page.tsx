import { redirect } from 'next/navigation';
import { routes } from '@/shared/routes';

// 要求時の値を読んでから移る（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

type Props = {
  params: Promise<{ id: string; rowId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * 写した 1 行の経路。シングルは一覧の右に出す（#366 の明文化）ので、その行を選んだ一覧へ移す。
 * 知らせの値（saved など）は引き継ぐ
 */
const Page = async ({ params, searchParams }: Props) => {
  const { id, rowId } = await params;
  const query = new URLSearchParams({ selected: rowId });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(`${routes.dash.resumes.entries(id, 'careers')}?${query}`);
};

export default Page;
