import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrganizationForm } from '@/features/organization/components/organization-form';
import { editOrganization } from '@/features/organization/server/actions';
import { getOrganizationForEdit } from '@/features/organization/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '組織を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、組織を読む前に 403 になる
  const found = await getOrganizationForEdit((await params).id);
  if (!found) notFound();
  const { organization, references } = found;
  const { saved } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.organizations.list}>組織の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">組織を編集する</h1>
      {saved === '1' && (
        <SavedNotice key={organization.updatedAt} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      <OrganizationForm
        key={organization.updatedAt}
        action={editOrganization}
        organizationUid={organization.uid}
        initialValues={{ name: organization.name, nameMasked: organization.nameMasked ?? '' }}
        isReferencedByMasked={references.isReferencedByMasked}
      />
      {!references.isReferenced && (
        <p>
          <TextLink href={routes.dash.organizations.delete(organization.uid)}>
            この組織を削除する
          </TextLink>
        </p>
      )}
    </main>
  );
};

export default Page;
