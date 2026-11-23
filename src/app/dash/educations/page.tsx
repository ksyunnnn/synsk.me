import type { Metadata } from 'next';
import { listEducations } from '@/features/education/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { formatPeriod } from '@/shared/domain/period';
import { firstParam } from '@/shared/domain/search-param';
import { routes } from '@/shared/routes';
import { EducationDetail } from './_detail';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '学歴 | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** 学歴の Split view（#366 の明文化） */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { selected: firstParam(raw.selected) };
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
      {firstParam(raw.deleted) === '1' && (
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

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ学歴"
      detail={
        selected && <EducationDetail uid={selected} flags={{ saved: firstParam(raw.saved) }} />
      }
    />
  );
};

export default Page;
