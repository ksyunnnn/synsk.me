import { redirect } from 'next/navigation';

type RowPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * 管理画面の 1 件の経路から、その 1 件を選んだ一覧へ移す。シングルは一覧の右に出す
 * （#366 の明文化）。知らせの値（saved など）は引き継ぐ。使い手は各コレクションの `[id]/page.tsx`
 */
export const selectRowPage =
  (list: string) =>
  async ({ params, searchParams }: RowPageProps): Promise<never> => {
    const query = new URLSearchParams({ selected: (await params).id });
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === 'string') query.set(key, value);
    }
    redirect(`${list}?${query}`);
  };
