import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrganizationForm } from '@/features/organization/components/organization-form';
import { editOrganization } from '@/features/organization/server/actions';
import { getOrganizationForEdit } from '@/features/organization/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '組織を編集する | synsk.me' };

const LINK =
  'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // 作り手でなければ、組織を読む前に 403 になる
  const found = await getOrganizationForEdit((await params).id);
  if (!found) notFound();
  const { organization, references } = found;
  const { saved } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <Link href="/dash/organizations" className={LINK}>
          組織の一覧へ戻る
        </Link>
      </p>
      <h1 className="text-2xl font-bold">組織を編集する</h1>
      {saved === '1' && <p role="status">保存しました</p>}
      <OrganizationForm
        key={organization.updatedAt}
        action={editOrganization}
        organizationId={organization.id}
        initialValues={{ name: organization.name, nameMasked: organization.nameMasked ?? '' }}
        isReferencedByMasked={references.isReferencedByMasked}
      />
      {!references.isReferenced && (
        <p>
          <Link href={`/dash/organizations/${organization.id}/delete`} className={LINK}>
            この組織を削除する
          </Link>
        </p>
      )}
    </main>
  );
};

export default Page;
