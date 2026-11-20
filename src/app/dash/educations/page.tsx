import type { Metadata } from 'next';
import { EducationForm } from '@/features/education/components/education-form';
import { toEducationFormValues } from '@/features/education/domain/education';
import { editEducation } from '@/features/education/server/actions';
import { getEducationForEdit, listEducations } from '@/features/education/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  DetailHeading,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '学歴 | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 学歴の Split view（#366 の明文化） */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { selected: first(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const educations = await listEducations();
  const selected = params.selected ?? null;
  const link = (changes: Record<string, string | null>) =>
    withParam(routes.dash.educations.list, params, changes);

  const collection = (
    <>
      <CollectionToolbar
        title="学歴"
        summary={`${educations.length} 件`}
        action={{ href: routes.dash.educations.new, label: '追加' }}
      />
      <p className="px-5 pb-3 text-small text-muted-foreground">
        学歴は、職務経歴書を通してだけ訪問者に出ます
      </p>
      {first(raw.deleted) === '1' && (
        <SavedNotice flags={['deleted']} className="px-5 pb-2">
          学歴を削除しました
        </SavedNotice>
      )}
      {educations.length === 0 ? (
        <CollectionEmpty>登録した学歴はありません</CollectionEmpty>
      ) : (
        <CollectionTable
          rows={educations}
          rowKey={(e) => e.uid}
          rowHref={(e) => link({ selected: e.uid })}
          selectedKey={selected}
          draftKey={(e) => `education:${e.uid}`}
          columns={[
            { header: '学校', cell: (e) => e.school },
            { header: '学部', cell: (e) => e.department ?? '' },
            { header: '期間', cell: (e) => formatPeriod(e.period), nowrap: true, muted: true },
          ]}
        />
      )}
    </>
  );

  const detail = async (uid: string) => {
    const education = await getEducationForEdit(uid);
    if (!education) return <p className="py-12 text-center text-muted-foreground">この学歴はありません</p>;
    return (
      <div className="flex flex-col gap-6">
        <DetailHeading
          title={`${education.school}${education.department ? `・${education.department}` : ''}`}
          draftKey={`education:${education.uid}`}
        />
        {first(raw.saved) === '1' && <SavedNotice flags={['saved']}>保存しました</SavedNotice>}
        <EducationForm
          key={uid}
          action={editEducation}
          initialValues={toEducationFormValues(education)}
          educationUid={education.uid}
        />
        <p className="border-t border-border pt-6 text-small">
          <TextLink href={routes.dash.educations.delete(education.uid)}>この学歴を削除する</TextLink>
        </p>
      </div>
    );
  };

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ学歴"
      detail={selected && (await detail(selected))}
    />
  );
};

export default Page;
