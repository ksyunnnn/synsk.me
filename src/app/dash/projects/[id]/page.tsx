import { redirect } from 'next/navigation';
import { routes } from '@/shared/routes';

/**
 * 実績の 1 件の経路。シングルは一覧の右に出す（#366 の明文化）ので、その 1 件を選んだ一覧へ移す。
 * 知らせの値（saved など）は引き継ぐ
 */
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const Page = async ({ params, searchParams }: Props) => {
  const query = new URLSearchParams({ selected: (await params).id });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(`${routes.dash.projects.list}?${query}`);
};

export default Page;
