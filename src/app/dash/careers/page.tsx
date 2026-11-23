import type { Metadata } from 'next';
import { listCareers } from '@/features/career/server/queries';
import { PeriodTimeline } from '@/shared/components/period-timeline';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  SplitView,
  ViewSwitch,
  withParam,
} from '@/shared/components/split-view';
import { formatPeriodWithOngoing } from '@/shared/domain/period';
import { SITE_STATUS_LABELS } from '@/shared/domain/site-status';
import { firstParam } from '@/shared/domain/search-param';
import { routes } from '@/shared/routes';
import { CareerDetail } from './_detail';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴 | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** 職歴の Split view。一覧は実績と同じ形（表と縦の時系列）にする（#366 の決定） */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { view: firstParam(raw.view), selected: firstParam(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const careers = await listCareers();
  const view = params.view === 'timeline' ? 'timeline' : 'table';
  const selected = params.selected ?? null;
  const link = (changes: Record<string, string | null>) =>
    withParam(routes.dash.careers.list, params, changes);

  const collection = (
    <>
      <CollectionToolbar
        title="職歴"
        summary={`${careers.length} 件`}
        action={{ href: routes.dash.careers.new, label: '追加' }}
      >
        <ViewSwitch
          options={[
            { label: '表', href: link({ view: null }), current: view === 'table' },
            { label: '時系列', href: link({ view: 'timeline' }), current: view === 'timeline' },
          ]}
        />
      </CollectionToolbar>
      {firstParam(raw.deleted) === '1' && (
        <SavedNotice flags={['deleted']} className="px-5 pb-2">
          職歴を削除しました
        </SavedNotice>
      )}
      {careers.length === 0 ? (
        <CollectionEmpty>登録した職歴はありません</CollectionEmpty>
      ) : view === 'timeline' ? (
        <PeriodTimeline
          today={new Date().toISOString().slice(0, 10)}
          selectedKey={selected}
          items={careers.map((career) => ({
            key: career.uid,
            href: link({ selected: career.uid }),
            title: `${career.organizationName}・${career.role}`,
            meta: SITE_STATUS_LABELS[career.status],
            period: career.period,
            periodText: formatPeriodWithOngoing(career.period),
            draftKey: `career:${career.uid}`,
          }))}
        />
      ) : (
        <CollectionTable
          rows={careers}
          rowKey={(career) => career.uid}
          rowHref={(career) => link({ selected: career.uid })}
          selectedKey={selected}
          draftKey={(career) => `career:${career.uid}`}
          columns={[
            { header: '組織', cell: (career) => career.organizationName },
            { header: '肩書', cell: (career) => career.role },
            {
              header: '期間',
              cell: (career) => formatPeriodWithOngoing(career.period),
              nowrap: true,
              muted: true,
            },
            {
              header: 'サイト',
              cell: (career) => (career.status === 'published' ? '載せる' : '載せない'),
              nowrap: true,
              muted: true,
            },
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
      detailLabel="選んだ職歴"
      detail={
        selected && (
          <CareerDetail
            uid={selected}
            flags={{ saved: firstParam(raw.saved), mediaAdded: firstParam(raw.mediaAdded) }}
          />
        )
      }
    />
  );
};

export default Page;
